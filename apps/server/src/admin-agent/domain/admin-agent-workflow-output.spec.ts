import { describe, expect, it } from "vitest";
import type { AdminAgentFinding } from "./admin-agent-finding.entity";
import type { AdminAgentWorkflowActionExecutionResult } from "./admin-agent-workflow-action-executor";
import {
  createCommentModerationApprovalUpdate,
  createCommentModerationCompletionResult,
  isReadOnlyGenericApprovalAction,
  toAdminAgentWorkflowFailureMessage,
  toAdminAgentWorkflowOutputRecord,
  toCommentModerationScope,
  toCommentModerationWorkflowResult,
  toCommentModerationWorkflowOutput,
  toGenericApprovalWorkflowCompletedResult,
  toGenericApprovalWorkflowInterruptedResult,
  withGenericApprovalActionSummary,
} from "./admin-agent-workflow-output";
import type { AdminAgentRun } from "./admin-agent-run.entity";
import type { AdminAgentWorkflowApprovalInterruption } from "./admin-agent-workflow-approval";

describe("admin agent workflow output", () => {
  it("formats durable workflow failure messages without leaking oversized errors", () => {
    expect(toAdminAgentWorkflowFailureMessage(new Error(" failed "))).toBe("failed");
    expect(toAdminAgentWorkflowFailureMessage(" failed as text ")).toBe("failed as text");
    expect(toAdminAgentWorkflowFailureMessage(new Error("x".repeat(2200)))).toHaveLength(2000);
    expect(toAdminAgentWorkflowFailureMessage(null)).toBe(
      "Admin agent workflow failed with an unknown error.",
    );
  });

  it("normalizes graph output into a record response boundary", () => {
    expect(toAdminAgentWorkflowOutputRecord({ findingCount: 2 })).toEqual({ findingCount: 2 });
    expect(toAdminAgentWorkflowOutputRecord(null)).toEqual({});
    expect(toAdminAgentWorkflowOutputRecord(["not", "a", "record"])).toEqual({});
  });

  it("creates comment moderation output from persisted findings", () => {
    expect(toCommentModerationScope("today")).toBe("today");
    expect(toCommentModerationScope("unknown")).toBe("recentVisibleFallback");

    expect(
      toCommentModerationWorkflowOutput(
        [createFinding("finding-1"), createFinding("finding-2")],
        "recentVisibleFallback",
      ),
    ).toEqual({
      actionResult: null,
      analyzedCount: 0,
      findingCount: 2,
      findingIds: ["finding-1", "finding-2"],
      scope: "recentVisibleFallback",
    });
  });

  it("normalizes comment moderation graph results for interrupted runs", () => {
    const finding = createFinding("finding-1");
    const run = createRun({ status: "WAITING_FOR_APPROVAL", summary: "等待确认" });
    const interruption: AdminAgentWorkflowApprovalInterruption = {
      action: "HIDE_COMMENT",
      approvalId: "comment-moderation:run-1",
      findingIds: ["finding-1"],
      kind: "COMMENT_MODERATION_APPROVAL",
      options: [],
      payload: {
        findingIds: ["finding-1"],
        scope: "today",
      },
      question: "是否确认屏蔽 1 条评论？",
      scope: "today",
      subject: "ARTICLE_COMMENT",
      summary: "确认后将屏蔽 1 条评论。",
    };

    expect(
      toCommentModerationWorkflowResult({
        interruption,
        result: {
          findings: [finding],
          scope: "today",
        },
        run,
      }),
    ).toEqual({
      findings: [finding],
      interruption,
      output: {
        actionResult: null,
        analyzedCount: 0,
        findingCount: 1,
        findingIds: ["finding-1"],
        scope: "today",
      },
      run,
      scope: "today",
      summary: "等待确认",
    });
  });

  it("normalizes comment moderation graph results for completed runs", () => {
    const actionResult: AdminAgentWorkflowActionExecutionResult = {
      appliedCount: 1,
      failedCount: 0,
      results: [{ resourceId: "comment-1", status: "APPLIED" }],
    };
    const run = createRun({ summary: "持久化完成摘要" });

    expect(
      toCommentModerationWorkflowResult({
        interruption: null,
        result: {
          actionResult,
          findings: [createFinding("finding-1")],
          scope: "bad-scope",
          summary: "模型完成摘要",
        },
        run,
      }),
    ).toMatchObject({
      interruption: null,
      output: {
        actionResult,
        analyzedCount: 0,
        findingCount: 1,
        findingIds: ["finding-1"],
        scope: "recentVisibleFallback",
      },
      run,
      scope: "recentVisibleFallback",
      summary: "模型完成摘要",
    });
  });

  it("creates comment moderation approval summaries for deferred writes", () => {
    expect(
      createCommentModerationApprovalUpdate({
        actionResult: null,
        approval: null,
        findingCount: 0,
        summary: "未发现风险。",
      }),
    ).toEqual({
      actionResult: null,
      summary: "未发现风险。",
    });

    expect(
      createCommentModerationApprovalUpdate({
        actionResult: null,
        approval: {
          decision: "DEFER",
          findingIds: ["finding-1"],
        },
        summary: "模型已生成治理建议。",
      }),
    ).toEqual({
      actionResult: null,
      summary: "模型已生成治理建议。\n管理员选择暂不执行写操作，任务已结束。",
    });
  });

  it("creates comment moderation approval summaries from action execution counts", () => {
    const actionResult: AdminAgentWorkflowActionExecutionResult = {
      appliedCount: 2,
      failedCount: 1,
      results: [
        { resourceId: "comment-1", status: "APPLIED" },
        { resourceId: "comment-2", status: "APPLIED" },
        {
          error: { code: "COMMENT_UPDATE_FAILED", message: "failed" },
          resourceId: "comment-3",
          status: "FAILED",
        },
      ],
    };

    expect(
      createCommentModerationApprovalUpdate({
        actionResult,
        approval: {
          actor: { id: "admin-1", login: "Adrian-Zephyr-Liao" },
          decision: "APPROVE",
          findingIds: ["finding-1", "finding-2", "finding-3"],
        },
        summary: "模型已生成治理建议。",
      }),
    ).toEqual({
      actionResult,
      summary: "模型已生成治理建议。\n管理员已确认 3 条评论治理建议；已执行 2 条，失败 1 条。",
    });

    expect(
      createCommentModerationApprovalUpdate({
        actionResult: { appliedCount: 0, failedCount: 0, results: [] },
        approval: {
          actor: { id: "admin-1", login: "Adrian-Zephyr-Liao" },
          decision: "APPROVE",
          findingIds: [],
        },
      }).summary,
    ).toBe("评论治理建议已生成。\n管理员已确认写操作，但当前没有可执行的待处理屏蔽建议。");
  });

  it("creates comment moderation completion result from business state", () => {
    const actionResult: AdminAgentWorkflowActionExecutionResult = {
      appliedCount: 1,
      failedCount: 0,
      results: [{ resourceId: "comment-1", status: "APPLIED" }],
    };

    expect(
      createCommentModerationCompletionResult({
        actionResult,
        findings: [createFinding("finding-1")],
        scope: "recentVisibleFallback",
        summary: null,
      }),
    ).toEqual({
      output: {
        actionResult,
        analyzedCount: 0,
        findingCount: 1,
        findingIds: ["finding-1"],
        scope: "recentVisibleFallback",
      },
      summary: "评论治理任务已生成 1 条建议。",
    });
  });

  it("normalizes completed generic approval workflow results", () => {
    expect(
      toGenericApprovalWorkflowCompletedResult(
        {
          output: { reviewed: true },
          summary: "模型完成摘要",
        },
        createRun({ summary: "持久化摘要" }),
      ),
    ).toEqual({
      interruption: null,
      output: { reviewed: true },
      run: createRun({ summary: "持久化摘要" }),
      summary: "模型完成摘要",
    });

    expect(
      toGenericApprovalWorkflowCompletedResult({ output: ["invalid"] }, createRun()),
    ).toMatchObject({
      interruption: null,
      output: {},
      summary: "持久化摘要",
    });
  });

  it("normalizes interrupted generic approval workflow results", () => {
    const interruption = createGenericApprovalInterruption();

    expect(
      toGenericApprovalWorkflowInterruptedResult(
        {
          output: { action: "pending" },
        },
        createRun({ summary: null }),
        interruption,
      ),
    ).toEqual({
      interruption,
      output: { action: "pending" },
      run: createRun({ summary: null }),
      summary: "等待确认",
    });
  });

  it("appends write execution counts to approval summaries", () => {
    expect(withGenericApprovalActionSummary("站点配置巡检完成。", null)).toBe("站点配置巡检完成。");

    expect(
      withGenericApprovalActionSummary("站点配置巡检完成。", {
        appliedCount: 2,
        failedCount: 1,
        results: [],
      }),
    ).toBe("站点配置巡检完成。\n已执行审批写操作：成功 2 项，失败 1 项。");
  });

  it("classifies generic approval actions that do not perform writes", () => {
    expect(isReadOnlyGenericApprovalAction(undefined)).toBe(true);
    expect(isReadOnlyGenericApprovalAction("REVIEW_ARTICLE_ASSISTANCE")).toBe(true);
    expect(isReadOnlyGenericApprovalAction("APPROVE_MULTI_TASK_PLAN")).toBe(true);
    expect(isReadOnlyGenericApprovalAction("UPDATE_SITE_ANNOUNCEMENT")).toBe(false);
  });
});

function createFinding(id: string): AdminAgentFinding {
  return {
    category: "ABUSE",
    confidence: 0.9,
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    evidence: ["evidence"],
    executedAt: null,
    id,
    proposedAction: "HIDE_COMMENT",
    reason: "risk",
    runId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: `comment-${id}`,
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
  };
}

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
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
    startedByUserId: "admin-1",
    status: "COMPLETED",
    summary: "持久化摘要",
    threadId: "run-1",
    type: "ARTICLE_ASSISTANCE",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    workflowName: "ARTICLE_ASSISTANCE",
    ...overrides,
  };
}

function createGenericApprovalInterruption(): Extract<
  AdminAgentWorkflowApprovalInterruption,
  { kind: "ADMIN_AGENT_APPROVAL" }
> {
  return {
    action: "REVIEW_ARTICLE_ASSISTANCE",
    approvalId: "approval-1",
    kind: "ADMIN_AGENT_APPROVAL",
    options: [],
    payload: {},
    question: "确认继续吗？",
    subject: "ARTICLE",
    summary: "等待确认",
  };
}
