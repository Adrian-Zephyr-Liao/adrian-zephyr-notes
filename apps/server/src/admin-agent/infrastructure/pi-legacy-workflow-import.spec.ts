import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { SiteAnnouncement } from "../../site-config/domain/site-announcement.entity";
import { decodeLegacyWorkflowImport, loadLegacyWorkflowImports } from "./pi-legacy-workflow-import";

const run = {
  id: "fixture",
  status: "WAITING_FOR_APPROVAL",
  workflow_name: "ARTICLE_ASSISTANCE",
  interruption: { approvalId: "review:fixture" },
};

// Scheduling fields captured from the project's previous StateGraph + MemorySaver implementation.
const checkpoint = {
  v: 4,
  channel_versions: {
    __start__: 2,
    runId: 2,
    input: 2,
    "branch:to:load_articles": 3,
    output: 3,
    summary: 3,
    "branch:to:request_article_approval": 3,
  },
  versions_seen: {
    __input__: {},
    __start__: { __start__: 1 },
    load_articles: { "branch:to:load_articles": 2 },
  },
};

function blob(channel: string, value: unknown, taskId?: string) {
  return {
    channel,
    type: "json",
    blob: new TextEncoder().encode(JSON.stringify(value)),
    task_id: taskId,
  };
}

function savedBlobs() {
  return [
    blob("runId", "fixture"),
    blob("input", {}),
    blob("output", { checks: [] }),
    blob("summary", "fixture"),
    blob("branch:to:request_article_approval", null),
  ];
}

describe("legacy Agent workflow import", () => {
  it("keeps a pending approval at the same business step and identity without importing authorization", () => {
    const imported = decodeLegacyWorkflowImport(run, checkpoint, savedBlobs(), [
      blob("__interrupt__", { value: run.interruption }, "waiting"),
    ]);
    expect(imported).toEqual({
      runId: "fixture",
      next: ["request_article_approval"],
      state: {
        runId: "fixture",
        input: {},
        output: { checks: [] },
        summary: "fixture",
        approval: null,
      },
    });
    expect(run.interruption).toEqual({ approvalId: "review:fixture" });
  });

  it("restores typed dates in business snapshots without changing text that looks like a date", () => {
    const date = "2026-11-05T16:00:00.000Z";
    const imported = decodeLegacyWorkflowImport(
      run,
      checkpoint,
      [
        ...savedBlobs(),
        blob("articles", [{ id: "a", createdAt: date, publishedAt: null, title: date }]),
        blob("article", { id: "a", updatedAt: date }),
        blob("comments", [{ createdAt: date }]),
        blob("logs", [{ createdAt: date }]),
        blob("siteConfig", { announcements: [{ updatedAt: date }] }),
      ],
      [],
    );
    expect(imported.state.articles).toEqual([
      { id: "a", createdAt: new Date(date), publishedAt: null, title: date },
    ]);
    expect(imported.state.article).toEqual({ id: "a", updatedAt: new Date(date) });
    expect(imported.state.comments).toEqual([{ createdAt: new Date(date) }]);
    expect(imported.state.logs).toEqual([{ createdAt: new Date(date) }]);
    expect(imported.state.siteConfig).toEqual({ announcements: [{ updatedAt: new Date(date) }] });
  });

  it("applies committed pending node writes before continuing instead of repeating that node", () => {
    const imported = decodeLegacyWorkflowImport(
      { ...run, status: "RUNNING" },
      checkpoint,
      savedBlobs(),
      [
        blob("output", { checks: [{ title: "saved" }] }, "completed-node"),
        blob("branch:to:complete_article_assistance", null, "completed-node"),
      ],
    );
    expect(imported.next).toEqual(["complete_article_assistance"]);
    expect(imported.state.output).toEqual({ checks: [{ title: "saved" }] });
  });

  it("normalizes legacy SiteAnnouncement private props into a plain dated snapshot", () => {
    const date = new Date("2026-11-05T16:00:00.000Z");
    const announcement = SiteAnnouncement.create({
      id: "announcement-1",
      key: "welcome",
      title: "Welcome",
      icon: "info",
      iconClassName: "",
      command: "view",
      process: "home",
      status: "enabled",
      output: "Welcome message",
      isEnabled: true,
      sortOrder: 10,
      createdAt: date,
      updatedAt: date,
    });
    const imported = decodeLegacyWorkflowImport(
      run,
      checkpoint,
      [...savedBlobs(), blob("siteConfig", { settings: {}, announcements: [announcement] })],
      [],
    );
    expect(imported.state.siteConfig).toEqual({
      settings: {},
      announcements: [
        {
          id: "announcement-1",
          key: "welcome",
          title: "Welcome",
          icon: "info",
          iconClassName: "",
          command: "view",
          process: "home",
          status: "enabled",
          output: "Welcome message",
          isEnabled: true,
          sortOrder: 10,
          createdAt: date,
          updatedAt: date,
        },
      ],
    });
  });

  it("starts an admitted input that never reached its first business step", () => {
    const imported = decodeLegacyWorkflowImport(
      { ...run, status: "PENDING" },
      {
        v: 4,
        channel_versions: { __start__: 1 },
        versions_seen: {},
      },
      [blob("__start__", { runId: "fixture", input: { search: "draft" } })],
      [],
    );
    expect(imported.next).toEqual(["load_articles"]);
    expect(imported.state.input).toEqual({ search: "draft" });
  });

  it("rejects binary and executable serialized values rather than loading arbitrary constructors", () => {
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [...savedBlobs(), { ...blob("articles", []), type: "bytes" }],
        [],
      ),
    ).toThrow("Unsupported legacy serialization");
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [...savedBlobs(), blob("articles", [{ lc: 1, type: "constructor", id: ["unknown"] }])],
        [],
      ),
    ).toThrow("unsupported serialized constructor");
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [
          ...savedBlobs(),
          { ...blob("output", {}), blob: new TextEncoder().encode('{"__proto__":{}}') },
        ],
        [],
      ),
    ).toThrow("Unsafe legacy checkpoint property");
  });

  it("rejects mismatched run IDs, invalid dates, unknown nodes, and parallel pending writes", () => {
    expect(() =>
      decodeLegacyWorkflowImport({ ...run, id: {} }, checkpoint, savedBlobs(), []),
    ).toThrow("Invalid legacy run id");
    expect(() =>
      decodeLegacyWorkflowImport(run, checkpoint, [...savedBlobs(), blob("runId", "other")], []),
    ).toThrow("does not belong");
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [...savedBlobs(), blob("logs", [{ createdAt: "bad-date" }])],
        [],
      ),
    ).toThrow("Invalid legacy snapshot date");
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [...savedBlobs(), blob("logs", [{ createdAt: {} }])],
        [],
      ),
    ).toThrow("Invalid legacy snapshot date");
    expect(() =>
      decodeLegacyWorkflowImport(
        run,
        checkpoint,
        [...savedBlobs(), blob("branch:to:unknown", null)],
        [],
      ),
    ).toThrow("Unsupported legacy scheduling");
    expect(() =>
      decodeLegacyWorkflowImport(run, checkpoint, savedBlobs(), [
        blob("summary", "one", "one"),
        blob("summary", "two", "two"),
      ]),
    ).toThrow("concurrent pending writes");
  });

  it("does not reinterpret a waiting approval as a running write", () => {
    expect(() =>
      decodeLegacyWorkflowImport(run, checkpoint, savedBlobs(), [
        blob("branch:to:complete_article_assistance", null, "done"),
      ]),
    ).toThrow("resumable approval checkpoint");
  });

  it("reads legacy state in one read-only transaction and leaves source rows untouched", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM admin_agent_runs")) return { rows: [{ ...run, thread_id: "thread" }] };
      if (sql.includes(".checkpoints"))
        return { rows: [{ checkpoint_id: "checkpoint", checkpoint }] };
      if (sql.includes(".checkpoint_blobs")) return { rows: savedBlobs() };
      return { rows: [] };
    });
    expect(await loadLegacyWorkflowImports(new ConfigService({}), query)).toHaveLength(1);
    expect(query.mock.calls[0]?.[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(query.mock.calls.some(([sql]) => /\b(UPDATE|DELETE|INSERT|DROP)\b/.test(sql))).toBe(
      false,
    );
  });

  it("rejects a missing active checkpoint and rolls the read transaction back", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("FROM admin_agent_runs") ? [run] : [],
    }));
    await expect(loadLegacyWorkflowImports(new ConfigService({}), query)).rejects.toThrow(
      "restore its checkpoint backup",
    );
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });

  it("recovers a pending run with no checkpoint from its durable input", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("FROM admin_agent_runs")
        ? [
            {
              ...run,
              status: "PENDING",
              input: { workflowInput: { search: "draft" } },
              started_by_user_id: "admin",
            },
          ]
        : [],
    }));
    expect(await loadLegacyWorkflowImports(new ConfigService({}), query)).toEqual([
      {
        runId: "fixture",
        next: ["load_articles"],
        state: { runId: "fixture", input: { search: "draft" }, startedByUserId: "admin" },
      },
    ]);
  });

  it("validates the legacy schema name before opening a database connection", async () => {
    const query = vi.fn();
    await expect(
      loadLegacyWorkflowImports(
        new ConfigService({ PI_AGENT_LEGACY_CHECKPOINT_SCHEMA: 'public"; DROP TABLE x' }),
        query,
      ),
    ).rejects.toThrow("lowercase PostgreSQL identifier");
    expect(query).not.toHaveBeenCalled();
  });

  it("excludes runs already durable in pi without reading their old checkpoint again", async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({ rows: [] }));
    await loadLegacyWorkflowImports(new ConfigService({}), query, ["already-imported"]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("NOT (id::text = ANY($1::text[]))"),
      [["already-imported"]],
    );
    expect(query.mock.calls).toHaveLength(3);
  });
});
