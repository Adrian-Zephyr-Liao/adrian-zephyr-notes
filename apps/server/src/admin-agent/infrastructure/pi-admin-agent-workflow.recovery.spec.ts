import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetAdminSiteConfigUseCase } from "../../site-config/application/get-admin-site-config.use-case";
import { SiteAnnouncement } from "../../site-config/domain/site-announcement.entity";
import { defaultSiteConfigSettings } from "../../site-config/domain/site-settings";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import { AdminAgentWorkflowInvalidResumeError } from "../domain/admin-agent-workflow-runner";
import {
  createChatCompletionClientDouble,
  createComment,
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
} from "../testing/admin-agent-workflow-test-doubles";
import type { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";
import { Harness, openNodeSqliteStorage } from "./pi-admin-agent-runtime.mjs";
import { PiAdminAgentWorkflowRunner } from "./pi-admin-agent-workflow.runner";

describe("Pi business task SQLite recovery", () => {
  let directory: string;
  const runners = new Set<PiAdminAgentWorkflowRunner>();

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "az-pi-recovery-"));
  });
  afterEach(async () => {
    for (const runner of runners) await runner.onModuleDestroy();
    runners.clear();
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
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

  it.each(["approve", "reject"])(
    "retains an early %s response while the approval projection precedes the Pi checkpoint",
    async (decision) => {
      const repository = new RecordingAdminAgentRepository();
      const executor = new RecordingAdminAgentWorkflowActionExecutor({
        appliedCount: 1,
        failedCount: 0,
        results: [{ status: "APPLIED", resourceId: "announcement-1" }],
      });
      const model = createChatCompletionClientDouble(
        '{"summary":"Review","checks":[],"nextActions":[]}',
      );
      const opening = vi.spyOn(Harness, "open");
      const runner = await open(repository, executor, model);
      const harness = await opening.mock.results[0]!.value;
      const projected = deferred<AdminAgentRun>();
      const release = deferred<void>();
      const markInterrupted = repository.markRunInterrupted.bind(repository);
      vi.spyOn(repository, "markRunInterrupted").mockImplementation(async (...args) => {
        const run = await markInterrupted(...args);
        projected.resolve(run);
        await release.promise;
        return run;
      });
      const waits = vi.spyOn(harness, "waitForTask");
      const starting = runner.startWorkflow(approvalInput);
      const pending = await projected.promise;
      const resume = {
        actor: { id: "admin-2", login: "reviewer" },
        threadId: pending.threadId!,
        workflowName: "SITE_CONFIG_REVIEW" as const,
        resume: {
          approvalId: pending.interruption!.approvalId,
          action: "UPDATE_SITE_ANNOUNCEMENT",
          subject: "SITE_CONFIG",
          decision,
          payload: { announcementId: "forged", isEnabled: true },
        },
      };
      const resumed = Promise.all([runner.resumeWorkflow(resume), runner.resumeWorkflow(resume)]);
      try {
        await vi.waitFor(() => expect(waits).toHaveBeenCalledTimes(3));
        expect(executor.calls).toHaveLength(0);
      } finally {
        release.resolve();
      }
      await starting;
      const results = await resumed;
      expect(results.map((result) => result.run.status)).toEqual(["COMPLETED", "COMPLETED"]);
      expect(executor.calls).toHaveLength(decision === "approve" ? 1 : 0);
      if (decision === "approve")
        expect(executor.calls[0]).toMatchObject({
          actor: { id: "admin-2" },
          payload: { announcementId: "announcement-1", isEnabled: false },
        });
      await close(runner);
      await open(repository, executor, model);
      expect((await repository.findRunById(pending.id))?.status).toBe("COMPLETED");
      expect(model.calls).toHaveLength(1);
      expect(executor.calls).toHaveLength(decision === "approve" ? 1 : 0);
    },
  );

  it("admits duplicate approvals once and rejects a conflicting concurrent response", async () => {
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
      runner.resumeWorkflow({ ...resume, resume: { ...resume.resume, decision: "reject" } }),
    ]);
    expect(responses.slice(0, 2).map((response) => response.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    expect(responses[2]).toMatchObject({
      status: "rejected",
      reason: expect.any(AdminAgentWorkflowInvalidResumeError),
    });
    expect(executor.calls).toHaveLength(1);
    expect(repository.listWorkflowActionExecutions()).toHaveLength(1);
    expect((await repository.findRunById(pending.run.id))?.status).toBe("COMPLETED");
  });

  it("rejects an approval awaiting its analysis task when the host shuts down", async () => {
    const repository = new RecordingAdminAgentRepository();
    const executor = new RecordingAdminAgentWorkflowActionExecutor();
    const opening = vi.spyOn(Harness, "open");
    const runner = await open(
      repository,
      executor,
      createChatCompletionClientDouble('{"summary":"Review","checks":[],"nextActions":[]}'),
    );
    const harness = await opening.mock.results[0]!.value;
    const projected = deferred<AdminAgentRun>();
    const release = deferred<void>();
    const markInterrupted = repository.markRunInterrupted.bind(repository);
    vi.spyOn(repository, "markRunInterrupted").mockImplementation(async (...args) => {
      const run = await markInterrupted(...args);
      projected.resolve(run);
      await release.promise;
      return run;
    });
    const waits = vi.spyOn(harness, "waitForTask");
    const starting = runner.startWorkflow(approvalInput).catch(() => undefined);
    const pending = await projected.promise;
    const resumed = runner.resumeWorkflow({
      actor: { id: "admin", login: "reviewer" },
      threadId: pending.threadId!,
      workflowName: "SITE_CONFIG_REVIEW",
      resume: {
        approvalId: pending.interruption!.approvalId,
        action: "UPDATE_SITE_ANNOUNCEMENT",
        subject: "SITE_CONFIG",
        decision: "approve",
      },
    });
    const response = Promise.allSettled([resumed]);
    let stopping: Promise<void> | undefined;
    try {
      await vi.waitFor(() => expect(waits).toHaveBeenCalledTimes(2));
      stopping = runner.onModuleDestroy();
      expect(await response).toMatchObject([{ status: "rejected" }]);
      expect(executor.calls).toHaveLength(0);
    } finally {
      release.resolve();
      await stopping;
      await starting;
    }
  });

  it("detaches a workflow waiter without cancelling analysis and reconnects to the same durable run", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const executor = new RecordingAdminAgentWorkflowActionExecutor();
    const model = createChatCompletionClientDouble("{}");
    const entered = deferred<AbortSignal>();
    const completion = deferred<string>();
    const complete = vi.spyOn(model, "complete").mockImplementation((input) => {
      entered.resolve(input.signal!);
      return completion.promise;
    });
    const opening = vi.spyOn(Harness, "open");
    const runner = await open(repository, executor, model);
    const waits = vi.spyOn(await opening.mock.results[0]!.value, "waitForTask");
    const detach = new AbortController();
    const input = {
      startedByUserId: "admin",
      workflowName: "COMMENT_MODERATION_ANALYSIS" as const,
      dedupeKey: "chat-analysis:stable-call",
    };
    const disconnected = runner.startWorkflow({ ...input, waitSignal: detach.signal });
    const signal = await entered.promise;
    detach.abort();
    await expect(disconnected).rejects.toMatchObject({ name: "AbortError" });
    const runId = repository.createdRuns[0]!.id!;
    expect((await repository.findRunById(runId))?.status).toBe("RUNNING");
    expect(signal.aborted).toBe(false);
    const reconnected = runner.startWorkflow(input);
    try {
      await vi.waitFor(() => expect(waits).toHaveBeenCalledTimes(2));
      expect(repository.createdRuns).toHaveLength(1);
    } finally {
      completion.resolve('{"summary":"Recovered analysis","findings":[]}');
    }
    expect(await reconnected).toMatchObject({ run: { id: runId, status: "COMPLETED" } });
    expect(complete).toHaveBeenCalledTimes(1);
    await runner.cancelWorkflow(runId);
    expect((await repository.findRunById(runId))?.status).toBe("COMPLETED");
  });

  it("finishes durable admission before an interrupted waiter lets Stop cancel the new run", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const model = createChatCompletionClientDouble("{}");
    vi.spyOn(model, "complete").mockImplementation(
      (input) =>
        new Promise<string>((_resolve, reject) => {
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          });
        }),
    );
    const runner = await open(repository, new RecordingAdminAgentWorkflowActionExecutor(), model);
    const projected = deferred<AdminAgentRun>();
    const release = deferred<void>();
    const createRun = repository.createRun.bind(repository);
    vi.spyOn(repository, "createRun").mockImplementation(async (input) => {
      const run = await createRun(input);
      projected.resolve(run);
      await release.promise;
      return run;
    });
    const detach = new AbortController();
    const starting = runner.startWorkflow({
      startedByUserId: "admin",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
      dedupeKey: "chat-analysis:admission-race",
      waitSignal: detach.signal,
    });
    const run = await projected.promise;
    let waitingEnded = false;
    const stopping = starting.catch(async () => {
      waitingEnded = true;
      await runner.cancelWorkflow(run.id);
    });
    detach.abort();
    try {
      expect(waitingEnded).toBe(false);
      expect((await repository.findRunByDedupeKey("chat-analysis:admission-race"))?.status).toBe(
        "PENDING",
      );
    } finally {
      release.resolve();
    }
    await expect(starting).rejects.toMatchObject({ name: "AbortError" });
    await stopping;
    expect((await repository.findRunById(run.id))?.status).toBe("CANCELLED");
    expect(repository.createdRuns).toHaveLength(1);
    expect(repository.createdFindings).toHaveLength(0);
  });

  it("keeps explicit workflow cancellation signals connected to the model and business task", async () => {
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
    const cancel = new AbortController();
    const running = runner.startWorkflow({
      signal: cancel.signal,
      startedByUserId: "admin",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const settled = running.catch(() => null);
    await active;
    const id = repository.createdRuns[0]!.id!;
    cancel.abort();
    await settled;
    expect(signal?.aborted).toBe(true);
    expect((await repository.findRunById(id))?.status).toBe("CANCELLED");
    expect(repository.createdFindings).toHaveLength(0);
    expect(repository.failedRuns).toHaveLength(0);
    expect(executor.calls).toHaveLength(0);
  });

  it("suspends a parent and its child analysis on host shutdown and recovers both without cancellation", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const executor = new RecordingAdminAgentWorkflowActionExecutor();
    const model = createChatCompletionClientDouble("{}");
    const entered = deferred<void>();
    vi.spyOn(model, "complete").mockImplementation(
      (input) =>
        new Promise<string>((_resolve, reject) => {
          entered.resolve();
          input.signal!.addEventListener("abort", () => reject(input.signal!.reason), {
            once: true,
          });
        }),
    );
    const first = await open(repository, executor, model);
    const interrupted = first
      .startWorkflow({
        startedByUserId: "admin",
        workflowName: "MULTI_TASK_ORCHESTRATION",
        input: { tasks: [{ taskName: "comment_moderation_analysis", input: {} }] },
      })
      .catch(() => null);
    await entered.promise;
    await close(first);
    await interrupted;
    expect(repository.createdRuns).toHaveLength(2);
    for (const created of repository.createdRuns)
      expect((await repository.findRunById(created.id!))?.status).toBe("RUNNING");
    await open(
      repository,
      executor,
      createChatCompletionClientDouble('{"summary":"Recovered child analysis","findings":[]}'),
    );
    await vi.waitFor(async () => {
      for (const created of repository.createdRuns)
        expect((await repository.findRunById(created.id!))?.status).toBe("COMPLETED");
    });
    expect(repository.createdRuns).toHaveLength(2);
    expect(repository.failedRuns).toHaveLength(0);
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
