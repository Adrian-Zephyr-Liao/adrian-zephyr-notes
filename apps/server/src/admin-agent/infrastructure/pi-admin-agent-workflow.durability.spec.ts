import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GetAdminSiteConfigUseCase } from "../../site-config/application/get-admin-site-config.use-case";
import type { ListAdminOperationLogsUseCase } from "../../audit/application/list-admin-operation-logs.use-case";
import { SiteAnnouncement } from "../../site-config/domain/site-announcement.entity";
import { defaultSiteConfigSettings } from "../../site-config/domain/site-settings";
import { adminAgentWorkflowActionExecutionLeaseMs } from "../domain/admin-agent-workflow-action-execution.entity";
import { createCommentModerationApprovalInterruption } from "../domain/admin-agent-workflow-approval";
import { AdminAgentWorkflowInvalidResumeError } from "../domain/admin-agent-workflow-runner";
import {
  createChatCompletionClientDouble,
  createComment,
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
} from "../testing/admin-agent-workflow-test-doubles";
import { openNodeSqliteStorage } from "./pi-admin-agent-runtime.mjs";
import { PiAdminAgentWorkflowRunner } from "./pi-admin-agent-workflow.runner";

describe("Pi workflow admission and durable waits", () => {
  const runners = new Set<PiAdminAgentWorkflowRunner>();
  const directories: string[] = [];
  afterEach(async () => {
    for (const runner of runners) await runner.onModuleDestroy();
    runners.clear();
    for (const directory of directories.splice(0))
      await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function runner(
    repository: RecordingAdminAgentRepository,
    model = createChatCompletionClientDouble('{"summary":"Review","checks":[],"nextActions":[]}'),
    executor = new RecordingAdminAgentWorkflowActionExecutor(),
    file?: string,
  ) {
    const { MemoryStorage } = await import("@earendil-works/pi-durable");
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
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ],
      }),
    } as unknown as GetAdminSiteConfigUseCase;
    const audit = {
      execute: async () => ({ data: [] }),
    } as unknown as ListAdminOperationLogsUseCase;
    const created = new PiAdminAgentWorkflowRunner(
      repository,
      executor,
      model,
      new ConfigService({ DATABASE_URL: "" }),
      audit,
      siteConfig,
      undefined,
      undefined,
      { storage: file ? await openNodeSqliteStorage(file) : new MemoryStorage() },
    );
    runners.add(created);
    return created;
  }

  it("keeps lease contention asleep across a SQLite reopen instead of exhausting transient retries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "az-pi-lease-"));
    directories.push(directory);
    const file = join(directory, "runtime.sqlite");
    const repository = new RecordingAdminAgentRepository();
    const executor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [{ status: "APPLIED", resourceId: "announcement-1" }],
    });
    const model = createChatCompletionClientDouble(
      '{"summary":"Review","checks":[],"nextActions":[]}',
    );
    const first = await runner(repository, model, executor, file);
    const pending = await first.startWorkflow({
      workflowName: "SITE_CONFIG_REVIEW",
      startedByUserId: "admin",
      input: {
        requiresApproval: true,
        proposedAction: "UPDATE_SITE_ANNOUNCEMENT",
        actionPayload: { announcementId: "announcement-1", isEnabled: false },
      },
    });
    const ensure = repository.ensureWorkflowActionExecution.bind(repository);
    let calls = 0;
    const deadline = Date.now() + 700;
    vi.spyOn(repository, "ensureWorkflowActionExecution").mockImplementation(async (input) => {
      const claim = await ensure(input);
      return ++calls === 1
        ? {
            ...claim,
            claimStatus: "IN_PROGRESS",
            execution: {
              ...claim.execution,
              updatedAt: new Date(deadline - adminAgentWorkflowActionExecutionLeaseMs),
            },
          }
        : { ...claim, claimStatus: "CLAIMED" };
    });
    const resumed = first
      .resumeWorkflow({
        actor: { id: "admin", login: "reviewer" },
        workflowName: "SITE_CONFIG_REVIEW",
        threadId: pending.run.threadId!,
        resume: {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          subject: "SITE_CONFIG",
          approvalId: pending.interruption!.approvalId,
          decision: "approve",
        },
      })
      .catch(() => null);
    await vi.waitFor(() => expect(calls).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls).toBe(1);
    expect(repository.failedRuns).toHaveLength(0);
    await first.onModuleDestroy();
    runners.delete(first);
    await resumed;
    const reopened = await runner(repository, model, executor, file);
    await reopened.onModuleInit();
    await vi.waitFor(
      async () => expect((await repository.findRunById(pending.run.id))?.status).toBe("COMPLETED"),
      { timeout: 2000 },
    );
    expect(calls).toBe(2);
    expect(executor.calls).toHaveLength(1);
    expect(model.calls).toHaveLength(1);
    expect(repository.failedRuns).toHaveLength(0);
  });

  it("cancels a parent and its running child before a later planned child can start", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1")],
    });
    const model = createChatCompletionClientDouble("{}");
    let entered!: () => void;
    const active = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let signal: AbortSignal | undefined;
    vi.spyOn(model, "complete").mockImplementation(
      (input) =>
        new Promise((_resolve, reject) => {
          signal = input.signal;
          entered();
          signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
        }),
    );
    const current = await runner(repository, model);
    const running = current
      .startWorkflow({
        startedByUserId: "admin",
        workflowName: "MULTI_TASK_ORCHESTRATION",
        input: {
          tasks: [
            { taskName: "comment_moderation_analysis", reason: "First", input: {} },
            { taskName: "audit_review", reason: "Second", input: {} },
          ],
        },
      })
      .catch(() => null);
    await active;
    await current.cancelWorkflow(repository.createdRuns[0]!.id!);
    await running;
    expect(signal?.aborted).toBe(true);
    expect(repository.createdRuns).toHaveLength(2);
    for (const created of repository.createdRuns)
      expect((await repository.findRunById(created.id!))?.status).toBe("CANCELLED");
    expect(repository.createdFindings).toHaveLength(0);
    expect(repository.failedRuns).toHaveLength(0);
  });

  it("recovers a PENDING business admission but fails closed if RUNNING state has been lost", async () => {
    const pending = new RecordingAdminAgentRepository();
    await pending.createRun({
      id: "pending-gap",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
      type: "COMMENT_MODERATION_TODAY",
      input: { workflowInput: {} },
      metadata: { engine: "pi" },
      startedByUserId: "admin",
    });
    const current = await runner(pending);
    await current.onModuleInit();
    await vi.waitFor(async () =>
      expect((await pending.findRunById("pending-gap"))?.status).toBe("COMPLETED"),
    );
    expect(pending.createdRuns).toHaveLength(1);

    const missing = new RecordingAdminAgentRepository();
    await missing.createRun({
      id: "lost-running",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
      type: "COMMENT_MODERATION_TODAY",
      input: {},
      metadata: { engine: "pi" },
      startedByUserId: "admin",
    });
    await missing.markRunRunning("lost-running");
    await expect((await runner(missing)).onModuleInit()).rejects.toThrow("restore runtime storage");
  });

  it("refreshes a failed aggregate even when the scheduler reads it before the business transition finishes", async () => {
    const repository = new RecordingAdminAgentRepository();
    const current = await runner(repository);
    const completed = await current.startWorkflow({
      startedByUserId: "admin",
      workflowName: "MULTI_TASK_ORCHESTRATION",
      input: { tasks: [{ taskName: "audit_review", input: {}, reason: "Review" }] },
    });
    await repository.failRun(completed.run.id, "temporary aggregation failure");
    const mark = repository.markRunRunning.bind(repository);
    let entered!: () => void;
    let release!: () => void;
    const marking = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(repository, "markRunRunning").mockImplementation(async (id, options) => {
      entered();
      await gate;
      return mark(id, options);
    });
    const refresh = current.refreshWorkflow({
      runId: completed.run.id,
      startedByUserId: "admin",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const settled = refresh.catch((error) => error);
    await marking;
    await new Promise((resolve) => setTimeout(resolve, 30));
    release();
    expect(await settled).toMatchObject({ run: { status: "COMPLETED" } });
  });

  it.each(["APPROVE", "DEFER"] as const)(
    "imports, reopens and handles a legacy comment %s within its saved finding scope",
    async (decision) => {
      const directory = await mkdtemp(join(tmpdir(), "az-pi-legacy-comment-"));
      directories.push(directory);
      const file = join(directory, "runtime.sqlite");
      const repository = new RecordingAdminAgentRepository();
      const model = createChatCompletionClientDouble("{}");
      const executor = new RecordingAdminAgentWorkflowActionExecutor({
        appliedCount: 1,
        failedCount: 0,
        results: [{ status: "APPLIED", resourceId: "comment-1" }],
      });
      const runId = "legacy-comment-approval";
      await repository.createRun({
        id: runId,
        threadId: runId,
        workflowName: "COMMENT_MODERATION_ANALYSIS",
        type: "COMMENT_MODERATION_TODAY",
        input: { workflowInput: {} },
        startedByUserId: "admin",
      });
      const findings = await repository.createFindings(
        runId,
        ["comment-1", "comment-2"].map((targetId) => ({
          category: "SPAM",
          confidence: 0.9,
          evidence: ["Spam"],
          proposedAction: "HIDE_COMMENT",
          reason: "Review",
          severity: "HIGH",
          targetId,
          targetType: "ARTICLE_COMMENT",
        })),
      );
      const interruption = createCommentModerationApprovalInterruption({
        runId,
        scope: "selection",
        findingIds: findings.map((finding) => finding.id),
      });
      await repository.markRunInterrupted(runId, interruption, "Legacy approval", {
        approvalNode: "human_approval",
      });
      const first = await runner(repository, model, executor, file);
      await first.importLegacyRun({
        runId,
        next: ["human_approval"],
        state: {
          comments: [createComment("comment-1"), createComment("comment-2")],
          findings,
          scope: "selection",
          summary: "Legacy analysis",
        },
      });
      await first.onModuleDestroy();
      runners.delete(first);
      const reopened = await runner(repository, model, executor, file);
      await reopened.onModuleInit();
      const base = {
        actor: { id: "reviewer", login: "reviewer" },
        workflowName: "COMMENT_MODERATION_ANALYSIS" as const,
        threadId: runId,
      };
      await expect(
        reopened.resumeWorkflow({
          ...base,
          resume: { decision: "approve", findingIds: [findings[0]!.id] },
        }),
      ).rejects.toBeInstanceOf(AdminAgentWorkflowInvalidResumeError);
      await expect(
        reopened.resumeWorkflow({
          ...base,
          resume: { decision: "APPROVE", findingIds: ["forged-finding"] },
        }),
      ).rejects.toThrow("saved approval scope");
      expect((await repository.findRunById(runId))?.status).toBe("WAITING_FOR_APPROVAL");
      expect(executor.calls).toHaveLength(0);
      const selected = {
        ...base,
        resume: { decision, findingIds: [findings[0]!.id] },
      };
      let result;
      if (decision === "APPROVE") {
        const responses = await Promise.allSettled([
          reopened.resumeWorkflow(selected),
          reopened.resumeWorkflow({ ...base, resume: { decision, findingIds: [findings[1]!.id] } }),
        ]);
        expect(responses[0]?.status).toBe("fulfilled");
        expect(responses[1]).toMatchObject({
          status: "rejected",
          reason: expect.any(AdminAgentWorkflowInvalidResumeError),
        });
        result = (
          responses[0] as PromiseFulfilledResult<
            Awaited<ReturnType<typeof reopened.resumeWorkflow>>
          >
        ).value;
      } else result = await reopened.resumeWorkflow(selected);
      expect(result.run.status).toBe("COMPLETED");
      expect(model.calls).toHaveLength(0);
      expect(executor.calls).toHaveLength(decision === "APPROVE" ? 1 : 0);
      if (decision === "APPROVE") expect(executor.calls[0]?.findingIds).toEqual([findings[0]!.id]);
    },
  );
});
