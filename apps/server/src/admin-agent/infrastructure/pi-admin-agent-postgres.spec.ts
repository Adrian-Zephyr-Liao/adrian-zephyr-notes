import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadLegacyWorkflowImports } from "./pi-legacy-workflow-import";
import { openPiAdminAgentStorage } from "./pi-admin-agent-storage";
import {
  createChatCompletionClientDouble,
  createComment,
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
} from "../testing/admin-agent-workflow-test-doubles";
import { PiAdminAgentWorkflowRunner } from "./pi-admin-agent-workflow.runner";

const databaseUrl = process.env.PI_AGENT_POSTGRES_TEST_URL;

describe.skipIf(!databaseUrl)("Pi PostgreSQL ownership and legacy migration", () => {
  const schema = `pi_legacy_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  let directory: string;
  let config: ConfigService;
  const handles: Awaited<ReturnType<typeof openPiAdminAgentStorage>>[] = [];

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "az-pi-pg-test-"));
    await pool.query(`CREATE SCHEMA "${schema}"`);
    const migration = await readFile(
      join(
        __dirname,
        "../../../prisma/migrations/20260709223000_add_langgraph_checkpoint_tables/migration.sql",
      ),
      "utf8",
    );
    await pool.query(migration.replaceAll('"public"', `"${schema}"`));
    await pool.query(`CREATE TABLE "${schema}".admin_agent_runs (
      id uuid PRIMARY KEY, workflow_name text NOT NULL, thread_id text, status text NOT NULL,
      input jsonb NOT NULL DEFAULT '{}', interruption jsonb, metadata jsonb,
      started_by_user_id text, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-csearch_path=${schema}`);
    config = new ConfigService({
      DATABASE_URL: url.toString(),
      PI_AGENT_STORAGE_DIR: directory,
      PI_AGENT_LEGACY_CHECKPOINT_SCHEMA: schema,
    });
  });

  afterAll(async () => {
    for (const handle of handles) await handle.close();
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
    await rm(directory, { recursive: true, force: true });
  });

  it("imports actual PostgreSQL checkpoint blobs and leaves source history unchanged", async () => {
    const runId = randomUUID();
    const date = "2026-11-05T10:00:00.000Z";
    const state = {
      runId,
      input: { requiresApproval: true },
      output: { checks: [] },
      summary: "review",
      logs: [{ id: "log", createdAt: date }],
      "branch:to:request_audit_approval": null,
    };
    const checkpoint = {
      v: 4,
      channel_versions: Object.fromEntries(Object.keys(state).map((key) => [key, 3])),
      versions_seen: {},
    };
    await pool.query(
      `INSERT INTO "${schema}".admin_agent_runs (id, workflow_name, thread_id, status, interruption)
       VALUES ($1, 'AUDIT_REVIEW', $3, 'WAITING_FOR_APPROVAL', $2)`,
      [runId, { approvalId: `review:${runId}` }, runId],
    );
    await pool.query(
      `INSERT INTO "${schema}".checkpoints (thread_id, checkpoint_id, checkpoint) VALUES ($1, 'checkpoint-1', $2)`,
      [runId, checkpoint],
    );
    for (const [channel, value] of Object.entries(state)) {
      await pool.query(
        `INSERT INTO "${schema}".checkpoint_blobs (thread_id, channel, version, type, blob) VALUES ($1, $2, '3', 'json', $3)`,
        [runId, channel, Buffer.from(JSON.stringify(value))],
      );
    }
    const imported = await loadLegacyWorkflowImports(config);
    expect(imported).toMatchObject([
      {
        runId,
        next: ["request_audit_approval"],
        state: { runId, summary: "review", logs: [{ createdAt: new Date(date) }], approval: null },
      },
    ]);
    expect(
      (
        await pool.query(
          `SELECT status, interruption FROM "${schema}".admin_agent_runs WHERE id = $1`,
          [runId],
        )
      ).rows,
    ).toEqual([
      { status: "WAITING_FOR_APPROVAL", interruption: { approvalId: `review:${runId}` } },
    ]);
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS count FROM "${schema}".checkpoint_blobs WHERE thread_id = $1`,
          [runId],
        )
      ).rows[0].count,
    ).toBe(Object.keys(state).length);
    // Once pi owns the imported run, old checkpoint corruption must not break its restart.
    await pool.query(
      `UPDATE "${schema}".checkpoint_blobs SET type = 'unsupported' WHERE thread_id = $1`,
      [runId],
    );
    await expect(loadLegacyWorkflowImports(config, undefined, [runId])).resolves.toEqual([]);
    await expect(loadLegacyWorkflowImports(config)).rejects.toThrow(
      "Unsupported legacy serialization",
    );
    await pool.query(`UPDATE "${schema}".admin_agent_runs SET status = 'COMPLETED' WHERE id = $1`, [
      runId,
    ]);
  });

  it("enforces exclusive ownership across real PostgreSQL clients and releases it on close", async () => {
    const key = `ownership:${randomUUID()}`;
    const first = await openPiAdminAgentStorage(config, key);
    handles.push(first);
    await expect(openPiAdminAgentStorage(config, key)).rejects.toThrow("already owned");
    await first.close();
    const second = await openPiAdminAgentStorage(config, key);
    handles.push(second);
    expect(second.ownershipLost.aborted).toBe(false);
  });

  it("invalidates the SQLite owner when its PostgreSQL backend is terminated", async () => {
    const application = `pi_lease_${randomUUID()}`;
    const url = new URL(config.get<string>("DATABASE_URL")!);
    url.searchParams.set("application_name", application);
    const handle = await openPiAdminAgentStorage(
      new ConfigService({ DATABASE_URL: url.toString(), PI_AGENT_STORAGE_DIR: directory }),
      `lost:${randomUUID()}`,
    );
    handles.push(handle);
    const { rows } = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
      [application],
    );
    expect(rows).toHaveLength(1);
    await pool.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
    await vi.waitFor(() => expect(handle.ownershipLost.aborted).toBe(true));
    await handle.close();
  });

  it("automatically reopens the same workflow runner after its ownership backend is terminated", async () => {
    const application = `pi_workflow_${randomUUID()}`;
    const url = new URL(config.get<string>("DATABASE_URL")!);
    url.searchParams.set("application_name", application);
    const workflowConfig = new ConfigService({
      DATABASE_URL: url.toString(),
      PI_AGENT_STORAGE_DIR: directory,
      PI_AGENT_LEGACY_CHECKPOINT_SCHEMA: schema,
    });
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const executor = new RecordingAdminAgentWorkflowActionExecutor();
    const model = createChatCompletionClientDouble("{}");
    let entered!: () => void;
    const active = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let signal: AbortSignal | undefined;
    const complete = vi.spyOn(model, "complete").mockImplementationOnce(
      (input) =>
        new Promise<string>((_resolve, reject) => {
          signal = input.signal;
          entered();
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          });
        }),
    );
    complete.mockResolvedValue('{"summary":"Recovered after lost ownership","findings":[]}');
    const runner = new PiAdminAgentWorkflowRunner(repository, executor, model, workflowConfig);
    try {
      await runner.onModuleInit();
      const pending = runner
        .startWorkflow({ startedByUserId: "admin", workflowName: "COMMENT_MODERATION_ANALYSIS" })
        .catch(() => null);
      await active;
      const id = repository.createdRuns[0]!.id!;
      const { rows } = await pool.query(
        "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
        [application],
      );
      expect(rows).toHaveLength(1);
      await pool.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
      await vi.waitFor(() => expect(signal?.aborted).toBe(true));
      await pending;
      await vi.waitFor(async () =>
        expect((await repository.findRunById(id))?.status).toBe("COMPLETED"),
      );
      expect(repository.createdRuns).toHaveLength(1);
      expect(complete).toHaveBeenCalledTimes(2);
      expect(repository.nodeUpdates.filter((event) => event.node === "load_comments")).toHaveLength(
        1,
      );
      expect(executor.calls).toHaveLength(0);
    } finally {
      await runner.onModuleDestroy();
    }
  });

  it("cancels a blocked ownership recovery and leaves no connection or retry after shutdown", async () => {
    const application = `pi_shutdown_${randomUUID()}`;
    const url = new URL(config.get<string>("DATABASE_URL")!);
    url.searchParams.set("application_name", application);
    const runner = new PiAdminAgentWorkflowRunner(
      new RecordingAdminAgentRepository(),
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      new ConfigService({
        DATABASE_URL: url.toString(),
        PI_AGENT_STORAGE_DIR: directory,
        PI_AGENT_LEGACY_CHECKPOINT_SCHEMA: schema,
      }),
    );
    const blocker = new pg.Client({ connectionString: databaseUrl });
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    try {
      await runner.onModuleInit();
      await blocker.connect();
      const { rows } = await pool.query(
        "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
        [application],
      );
      await pool.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
      const hash = createHash("sha256").update("workflows").digest("hex");
      await blocker.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
        `az-notes:pi:${hash}`,
      ]);
      await vi.waitFor(() =>
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("already owned")),
      );
      await runner.onModuleDestroy();
      await blocker.end();
      const warningsAtShutdown = warning.mock.calls.length;
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      expect(warning.mock.calls).toHaveLength(warningsAtShutdown);
      expect(
        (
          await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name = $1", [
            application,
          ])
        ).rows,
      ).toHaveLength(0);
    } finally {
      await runner.onModuleDestroy();
      await blocker.end();
      warning.mockRestore();
    }
  });
});
