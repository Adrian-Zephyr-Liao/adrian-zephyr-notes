import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetAdminSiteConfigUseCase } from "../../site-config/application/get-admin-site-config.use-case";
import { SiteAnnouncement } from "../../site-config/domain/site-announcement.entity";
import { defaultSiteConfigSettings } from "../../site-config/domain/site-settings";
import {
  createChatCompletionClientDouble,
  createComment,
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
} from "../testing/admin-agent-workflow-test-doubles";
import type { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";
import { openNodeSqliteStorage } from "./pi-admin-agent-runtime.mjs";
import { PiAdminAgentWorkflowRunner } from "./pi-admin-agent-workflow.runner";

describe("Pi business task SQLite recovery", () => {
  let directory: string;
  const runners = new Set<PiAdminAgentWorkflowRunner>();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "az-pi-recovery-"));
  });
  afterEach(async () => {
    for (const runner of runners) await runner.onModuleDestroy();
    runners.clear();
    await rm(directory, { recursive: true, force: true });
  });

  async function open(
    repository: RecordingAdminAgentRepository,
    executor: RecordingAdminAgentWorkflowActionExecutor,
    model: PiAdminAgentModelClient,
  ) {
    const siteConfig = {
      execute: async () => ({
        settings: defaultSiteConfigSettings,
        announcements: [
          SiteAnnouncement.create({
            id: "announcement-1",
            key: "welcome",
            title: "Welcome",
            icon: "info",
            iconClassName: "",
            process: "home",
            status: "enabled",
            command: "view",
            output: "welcome",
            isEnabled: true,
            sortOrder: 10,
            createdAt: new Date("2026-11-05T10:00:00.000Z"),
            updatedAt: new Date("2026-11-05T10:00:00.000Z"),
          }),
        ],
      }),
    } as unknown as GetAdminSiteConfigUseCase;
    const runner = new PiAdminAgentWorkflowRunner(
      repository,
      executor,
      model,
      new ConfigService({ DATABASE_URL: "" }),
      undefined,
      siteConfig,
      undefined,
      undefined,
      { storage: await openNodeSqliteStorage(join(directory, "runtime.sqlite")) },
    );
    runners.add(runner);
    await runner.onModuleInit();
    return runner;
  }

  async function close(runner: PiAdminAgentWorkflowRunner) {
    await runner.onModuleDestroy();
    runners.delete(runner);
  }

  const approvalInput = {
    input: {
      requiresApproval: true,
      proposedAction: "UPDATE_SITE_ANNOUNCEMENT",
      actionPayload: { announcementId: "announcement-1", isEnabled: false },
    },
    startedByUserId: "admin-1",
    workflowName: "SITE_CONFIG_REVIEW" as const,
  };

  it("reopens a pending approval without another analysis and executes only its persisted scope", async () => {
    const repository = new RecordingAdminAgentRepository();
    const executor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [{ status: "APPLIED", resourceId: "announcement-1" }],
    });
    const model = createChatCompletionClientDouble(
      '{"summary":"Please review","checks":[],"nextActions":[]}',
    );
    const first = await open(repository, executor, model);
    const pending = await first.startWorkflow(approvalInput);
    expect(pending.run.status).toBe("WAITING_FOR_APPROVAL");
    expect(executor.calls).toHaveLength(0);
    expect(model.calls).toHaveLength(1);
    await close(first);

    const resumed = await open(repository, executor, model);
    expect((await repository.findRunById(pending.run.id))?.status).toBe("WAITING_FOR_APPROVAL");
    const result = await resumed.resumeWorkflow({
      actor: { id: "admin-2", login: "reviewer" },
      threadId: pending.run.threadId!,
      workflowName: "SITE_CONFIG_REVIEW",
      resume: {
        approvalId: pending.interruption!.approvalId,
        action: "UPDATE_SITE_ANNOUNCEMENT",
        subject: "SITE_CONFIG",
        decision: "approve",
        payload: { announcementId: "forged", isEnabled: true },
      },
    });
    expect(result.run.status).toBe("COMPLETED");
    expect(model.calls).toHaveLength(1);
    expect(executor.calls).toMatchObject([
      { actor: { id: "admin-2" }, payload: { announcementId: "announcement-1", isEnabled: false } },
    ]);
    expect(repository.listWorkflowActionExecutions()).toMatchObject([{ status: "SUCCEEDED" }]);
  });

  it("admits concurrent duplicate approval responses as one durable business action", async () => {
    const repository = new RecordingAdminAgentRepository();
    const executor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [{ status: "APPLIED", resourceId: "announcement-1" }],
    });
    const runner = await open(
      repository,
      executor,
      createChatCompletionClientDouble('{"summary":"Review","checks":[],"nextActions":[]}'),
    );
    const pending = await runner.startWorkflow(approvalInput);
    const resume = {
      actor: { id: "admin", login: "reviewer" },
      threadId: pending.run.threadId!,
      workflowName: "SITE_CONFIG_REVIEW" as const,
      resume: {
        approvalId: pending.interruption!.approvalId,
        action: "UPDATE_SITE_ANNOUNCEMENT",
        subject: "SITE_CONFIG",
        decision: "approve",
      },
    };
    const responses = await Promise.allSettled([
      runner.resumeWorkflow(resume),
      runner.resumeWorkflow(resume),
    ]);
    expect(responses.some((response) => response.status === "fulfilled")).toBe(true);
    expect(executor.calls).toHaveLength(1);
    expect(repository.listWorkflowActionExecutions()).toHaveLength(1);
    expect((await repository.findRunById(pending.run.id))?.status).toBe("COMPLETED");
  });

  it("propagates cancellation to the active model request and keeps the business task cancelled", async () => {
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
    vi.spyOn(model, "complete").mockImplementation(
      (input) =>
        new Promise<string>((_resolve, reject) => {
          signal = input.signal;
          entered();
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          });
        }),
    );
    const runner = await open(repository, executor, model);
    const running = runner.startWorkflow({
      startedByUserId: "admin",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const settled = running.catch(() => null);
    await active;
    const id = repository.createdRuns[0]!.id!;
    await runner.cancelWorkflow(id);
    await settled;
    expect(signal?.aborted).toBe(true);
    expect((await repository.findRunById(id))?.status).toBe("CANCELLED");
    expect(repository.createdFindings).toHaveLength(0);
    expect(repository.failedRuns).toHaveLength(0);
    expect(executor.calls).toHaveLength(0);
  });

  it("resumes a model phase interrupted by host shutdown when the same SQLite store reopens", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const executor = new RecordingAdminAgentWorkflowActionExecutor();
    const firstModel = createChatCompletionClientDouble("{}");
    let entered!: () => void;
    const active = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.spyOn(firstModel, "complete").mockImplementation(
      (input) =>
        new Promise<string>((_resolve, reject) => {
          entered();
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          });
        }),
    );
    const first = await open(repository, executor, firstModel);
    const interrupted = first
      .startWorkflow({ startedByUserId: "admin", workflowName: "COMMENT_MODERATION_ANALYSIS" })
      .catch(() => null);
    await active;
    const id = repository.createdRuns[0]!.id!;
    await close(first);
    await interrupted;
    expect((await repository.findRunById(id))?.status).toBe("RUNNING");

    const nextModel = createChatCompletionClientDouble(
      '{"summary":"Recovered analysis","findings":[]}',
    );
    await open(repository, executor, nextModel);
    await vi.waitFor(async () => {
      expect((await repository.findRunById(id))?.status).toBe("COMPLETED");
    });
    expect(repository.createdRuns).toHaveLength(1);
    expect(nextModel.calls).toHaveLength(1);
    expect(repository.nodeUpdates.filter((event) => event.node === "load_comments")).toHaveLength(
      1,
    );
    expect(repository.failedRuns).toHaveLength(0);
  });
});
