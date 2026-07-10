import { describe, expect, it, vi } from "vitest";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import type { AdminAgentWorkflowResult } from "../domain/admin-agent-workflow-runner";
import type { MultiTaskPlanItem } from "../domain/admin-agent-multi-task-orchestration";
import { toMultiTaskChildDedupeKey } from "../domain/admin-agent-multi-task-orchestration";
import { runAdminAgentMultiTaskChildren } from "./run-admin-agent-multi-task-children";

describe("runAdminAgentMultiTaskChildren", () => {
  it("reuses an existing child workflow run by dedupe key", async () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS")];
    const existingRun = createRun({
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
      id: "child-run-1",
      output: { findingCount: 2, workflow: "comment_moderation" },
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "COMPLETED",
      summary: "评论治理已完成。",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const repository = createRepository([existingRun]);
    const startChildWorkflow = vi.fn();

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(startChildWorkflow).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        childTaskKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
        errorMessage: null,
        interruptionKind: null,
        output: { findingCount: 2, workflow: "comment_moderation" },
        runId: "child-run-1",
        status: "COMPLETED",
        summary: "评论治理已完成。",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
  });

  it("reuses an existing child workflow when the refreshed plan order changes", async () => {
    const oldPlanItem: MultiTaskPlanItem = {
      input: { scope: "recent" },
      reason: "old plan reason",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    };
    const refreshedPlanItem: MultiTaskPlanItem = {
      input: { scope: "recent" },
      reason: "new plan reason",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    };
    const existingRun = createRun({
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 1, oldPlanItem),
      id: "child-run-1",
      output: { findingCount: 2, workflow: "comment_moderation" },
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "COMPLETED",
      summary: "评论治理已完成。",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const repository = createRepository([existingRun]);
    const startChildWorkflow = vi.fn();

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan: [refreshedPlanItem],
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(startChildWorkflow).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      childTaskKey: toMultiTaskChildDedupeKey("parent-run", 0, refreshedPlanItem),
      runId: "child-run-1",
      status: "COMPLETED",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("reuses child workflow runs beyond the first lookup page", async () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS", { scope: "recent" })];
    const existingRuns = Array.from({ length: 50 }, (_, index) =>
      createRun({
        createdAt: new Date("2026-07-09T00:01:00.000Z"),
        dedupeKey: `unrelated-child-${index}`,
        id: `unrelated-child-run-${index}`,
        parentRunId: "parent-run",
        parentRunRelation: "CHILD_TASK",
        status: "COMPLETED",
        workflowName: "AUDIT_REVIEW",
      }),
    );
    const targetRun = createRun({
      createdAt: new Date("2026-07-09T00:00:00.000Z"),
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
      id: "second-page-child-run",
      output: { findingCount: 1, workflow: "comment_moderation" },
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "COMPLETED",
      summary: "第二页评论治理已完成。",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const repository = createRepository([...existingRuns, targetRun]);
    const startChildWorkflow = vi.fn();

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(repository.listRuns).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
    });
    expect(repository.listRuns).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
    });
    expect(startChildWorkflow).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      runId: "second-page-child-run",
      status: "COMPLETED",
      summary: "第二页评论治理已完成。",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("uses the latest retry attempt as the effective result for an existing child workflow", async () => {
    const plan = [createPlanItem("AUDIT_REVIEW", { scope: "recent" })];
    const originalChildRun = createRun({
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
      errorMessage: "LLM request failed",
      id: "child-run-1",
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "FAILED",
      summary: "审计复核失败。",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });
    const retryRun = createRun({
      id: "retry-run-1",
      output: { findingCount: 0, workflow: "audit_review" },
      parentRunId: originalChildRun.id,
      parentRunRelation: "RETRY",
      status: "COMPLETED",
      summary: "审计复核已完成。",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });
    const repository = createRepository([originalChildRun, retryRun]);
    const startChildWorkflow = vi.fn();

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(startChildWorkflow).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        childTaskKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
        errorMessage: null,
        interruptionKind: null,
        output: { findingCount: 0, workflow: "audit_review" },
        runId: "retry-run-1",
        status: "COMPLETED",
        summary: "审计复核已完成。",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
  });

  it("uses deterministic ordering when multiple retry attempts share the same timestamp", async () => {
    const plan = [createPlanItem("AUDIT_REVIEW", { scope: "recent" })];
    const originalChildRun = createRun({
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
      errorMessage: "LLM request failed",
      id: "child-run-1",
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "FAILED",
      summary: "审计复核失败。",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });
    const olderRetryRun = createRun({
      createdAt: new Date("2026-07-09T00:02:00.000Z"),
      id: "retry-run-a",
      output: { findingCount: 0, workflow: "audit_review" },
      parentRunId: originalChildRun.id,
      parentRunRelation: "RETRY",
      status: "FAILED",
      summary: "审计复核重试失败。",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });
    const latestRetryRun = createRun({
      createdAt: new Date("2026-07-09T00:02:00.000Z"),
      id: "retry-run-z",
      output: { findingCount: 0, workflow: "audit_review" },
      parentRunId: originalChildRun.id,
      parentRunRelation: "RETRY",
      status: "COMPLETED",
      summary: "审计复核最新重试已完成。",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });
    const repository = createRepository([originalChildRun, olderRetryRun, latestRetryRun]);
    const startChildWorkflow = vi.fn();

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(startChildWorkflow).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      runId: "retry-run-z",
      status: "COMPLETED",
      summary: "审计复核最新重试已完成。",
      workflowName: "AUDIT_REVIEW",
    });
  });

  it("ignores branch and retry descendants when reusing multi-task child runs", async () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS")];
    const dedupeKey = toMultiTaskChildDedupeKey("parent-run", 0, plan[0]);
    const branchRun = createRun({
      dedupeKey,
      id: "branch-run",
      parentRunId: "parent-run",
      parentRunRelation: "BRANCH",
      status: "COMPLETED",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const retryRun = createRun({
      dedupeKey,
      id: "retry-run",
      parentRunId: "parent-run",
      parentRunRelation: "RETRY",
      status: "COMPLETED",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const repository = createRepository([branchRun, retryRun]);
    const childRun = createRun({
      id: "new-child-run",
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      status: "COMPLETED",
      summary: "评论治理已完成。",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const startChildWorkflow = vi.fn<() => Promise<AdminAgentWorkflowResult>>().mockResolvedValue({
      interruption: null,
      output: { workflow: "comment_moderation" },
      run: childRun,
      summary: "评论治理已完成。",
    });

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(repository.listRuns).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
    });
    expect(startChildWorkflow).toHaveBeenCalledOnce();
    expect(results[0]?.runId).toBe("new-child-run");
  });

  it("starts missing child workflows with deterministic dedupe keys", async () => {
    const plan = [createPlanItem("SITE_CONFIG_REVIEW", { section: "announcement" })];
    const repository = createRepository([]);
    const childRun = createRun({
      id: "child-run-2",
      parentRunId: "parent-run",
      status: "WAITING_FOR_APPROVAL",
      summary: "等待站点配置确认。",
      type: "SITE_CONFIG_REVIEW",
      workflowName: "SITE_CONFIG_REVIEW",
    });
    const startChildWorkflow = vi.fn<() => Promise<AdminAgentWorkflowResult>>().mockResolvedValue({
      interruption: {
        action: "UPDATE_SITE_ANNOUNCEMENT",
        approvalId: "approval-1",
        kind: "ADMIN_AGENT_APPROVAL",
        options: [],
        payload: {},
        question: "确认更新站点公告吗？",
        subject: "SITE_CONFIG",
        summary: "更新站点公告",
      },
      output: { workflow: "site_config_review" },
      run: childRun,
      summary: "等待站点配置确认。",
    });

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: "user-1",
    });

    expect(startChildWorkflow).toHaveBeenCalledWith({
      dedupeKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
      input: { section: "announcement" },
      parentRunId: "parent-run",
      startedByUserId: "user-1",
      startReason: "CHAT_INTENT",
      workflowName: "SITE_CONFIG_REVIEW",
    });
    expect(results).toEqual([
      {
        childTaskKey: null,
        errorMessage: null,
        interruptionKind: "ADMIN_AGENT_APPROVAL",
        output: { workflow: "site_config_review" },
        runId: "child-run-2",
        status: "WAITING_FOR_APPROVAL",
        summary: "等待站点配置确认。",
        workflowName: "SITE_CONFIG_REVIEW",
      },
    ]);
  });

  it("returns failed child results when a child workflow cannot start", async () => {
    const plan = [createPlanItem("AUDIT_REVIEW")];
    const repository = createRepository([]);
    const startChildWorkflow = vi.fn().mockRejectedValue(
      Object.assign(new Error("LLM request failed"), {
        runId: "failed-child-run",
      }),
    );

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: null,
    });

    expect(results).toEqual([
      {
        childTaskKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
        errorMessage: "LLM request failed",
        interruptionKind: null,
        output: null,
        runId: "failed-child-run",
        status: "FAILED",
        summary: "LLM request failed",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
  });

  it("returns a stable child key when a child workflow fails before creating a run", async () => {
    const plan = [createPlanItem("ARTICLE_ASSISTANCE", { articleId: "article-1" })];
    const repository = createRepository([]);
    const startChildWorkflow = vi.fn().mockRejectedValue(new Error("Model unavailable"));

    const results = await runAdminAgentMultiTaskChildren({
      parentRunId: "parent-run",
      plan,
      repository,
      startChildWorkflow,
      startedByUserId: null,
    });

    expect(results).toEqual([
      {
        childTaskKey: toMultiTaskChildDedupeKey("parent-run", 0, plan[0]),
        errorMessage: "Model unavailable",
        interruptionKind: null,
        output: null,
        runId: null,
        status: "FAILED",
        summary: "Model unavailable",
        workflowName: "ARTICLE_ASSISTANCE",
      },
    ]);
  });
});

function createRepository(runs: AdminAgentRun[]): Pick<AdminAgentRepository, "listRuns"> {
  return {
    listRuns: vi.fn(async (filters) => {
      const data = runs
        .filter(
          (run) =>
            (!filters.parentRunId || run.parentRunId === filters.parentRunId) &&
            (!filters.parentRunRelation || run.parentRunRelation === filters.parentRunRelation),
        )
        .sort(compareRunsByListOrder);
      const page = filters.page;
      const pageSize = filters.pageSize;
      const start = (page - 1) * pageSize;
      const pagedData = data.slice(start, start + pageSize);

      return {
        data: pagedData,
        pagination: {
          page,
          pageSize,
          totalItems: data.length,
          totalPages: data.length > 0 ? Math.ceil(data.length / pageSize) : 0,
        },
      };
    }),
  };
}

function compareRunsByListOrder(left: AdminAgentRun, right: AdminAgentRun) {
  const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return right.id.localeCompare(left.id);
}

function createPlanItem(
  workflowName: MultiTaskPlanItem["workflowName"],
  input: Record<string, unknown> = {},
): MultiTaskPlanItem {
  return {
    input,
    reason: "test",
    workflowName,
  };
}

function createRun(overrides: Partial<AdminAgentRun>): AdminAgentRun {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: null,
    status: "PENDING",
    summary: null,
    threadId: "thread-1",
    type: "MULTI_TASK_ORCHESTRATION",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    workflowName: "MULTI_TASK_ORCHESTRATION",
    ...overrides,
  };
}
