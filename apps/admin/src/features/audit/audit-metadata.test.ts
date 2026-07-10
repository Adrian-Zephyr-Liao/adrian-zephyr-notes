import { describe, expect, it } from "vitest";
import type { AdminOperationLogAction } from "@adrian-zephyr-notes/contracts";
import {
  formatAuditClientLabel,
  formatAuditMetadataEntries,
  formatAuditResourceLabel,
  formatAuditSummary,
} from "./audit-metadata";

describe("formatAuditMetadataEntries", () => {
  it("formats agent finding metadata in a stable scan order", () => {
    expect(
      formatAuditMetadataEntries({
        agentFindingId: "finding-1",
        agentRunId: "run-1",
        articleSlug: "markdown",
        decision: "RESTORE_COMMENT",
        source: "admin_agent",
        status: "VISIBLE",
        targetId: "comment-1",
      }),
    ).toEqual([
      { key: "agentFindingId", label: "建议编号", value: "finding-1" },
      { key: "decision", label: "Agent 决策", value: "恢复误判" },
      { key: "status", label: "评论状态", value: "可见" },
      { key: "targetId", label: "目标评论", value: "comment-1" },
      { key: "articleSlug", label: "文章", value: "markdown" },
      { key: "source", label: "来源", value: "Agent 工作台" },
    ]);
  });

  it("formats generated-finding audit metadata", () => {
    expect(
      formatAuditMetadataEntries({
        agentRunId: "run-1",
        findingCount: 2,
        source: "admin_agent",
        targetIds: ["comment-1", "comment-2"],
      }),
    ).toEqual([
      { key: "findingCount", label: "建议数量", value: "2" },
      { key: "targetIds", label: "目标评论", value: "comment-1、comment-2" },
      { key: "source", label: "来源", value: "Agent 工作台" },
    ]);
  });

  it("drops unknown metadata fields instead of rendering internal orchestration details", () => {
    expect(
      formatAuditMetadataEntries({
        checkpointNamespace: "admin-agent",
        nested: { ok: true },
        rawLangGraphState: { node: "approval" },
        retryCount: 2,
        workflowRevision: "v1",
      }),
    ).toEqual([]);
  });

  it("hides internal orchestration metadata", () => {
    expect(
      formatAuditMetadataEntries({
        agentTaskId: "task-1",
        checkpointId: "checkpoint-1",
        currentNode: "approval",
        agentRunId: "run-1",
        langGraphRunId: "langgraph-run-1",
        node: "approval",
        runId: "run-2",
        taskName: "comment_moderation_analysis",
        threadId: "thread-1",
        workflowCheckpoint: "workflow-checkpoint-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
        workflowRunId: "workflow-run-1",
      }),
    ).toEqual([]);
  });

  it("hides snake-case orchestration metadata from otherwise known fields", () => {
    expect(
      formatAuditMetadataEntries({
        source: {
          lang_graph_checkpoint: "checkpoint-1",
          run_id: "run-1",
          thread_id: "thread-1",
          workflow_run_id: "workflow-run-1",
        },
      }),
    ).toEqual([]);
  });

  it("hides orchestration details that were accidentally written as metadata values", () => {
    expect(
      formatAuditMetadataEntries({
        source: "Opened /agent/runs/thread-1 LangGraph checkpoint view.",
        targetIds: ["comment-1", "checkpoint threadId workflowName", "comment-2"],
      }),
    ).toEqual([{ key: "targetIds", label: "目标评论", value: "comment-1、comment-2" }]);
  });

  it("removes internal orchestration metadata from nested values", () => {
    expect(
      formatAuditMetadataEntries({
        execution: {
          checkpointId: "checkpoint-1",
          debugUrl: "/agent/runs/thread-1",
          result: "done",
          threadId: "thread-1",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        },
        runtimeDebugUrl: "/agent/runs/thread-1",
        langgraph_run_id: "langgraph-run-1",
        thread_id: "thread-1",
        visibleDetails: {
          currentWorkflowNode: "approval",
          resource: "comment-1",
        },
      }),
    ).toEqual([]);
  });

  it("shortens UUID-like values instead of exposing implementation ids", () => {
    expect(
      formatAuditMetadataEntries({
        agentFindingId: "84fdd3a4-2cec-47f8-9cc1-d2dff02debdd",
        targetId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
      }),
    ).toEqual([
      { key: "agentFindingId", label: "建议编号", value: "84fdd3a4..." },
      { key: "targetId", label: "目标评论", value: "77649607..." },
    ]);
  });
});

describe("audit presentation helpers", () => {
  it("formats comment and agent summaries in business language", () => {
    expect(
      formatAuditSummary(
        createLog({
          action: "COMMENT_STATUS_UPDATED",
          metadata: { status: "HIDDEN" },
          summary: "Updated article comment status to HIDDEN",
        }),
      ),
    ).toBe("评论已设为已隐藏");

    expect(
      formatAuditSummary(
        createLog({
          action: "ADMIN_AGENT_FINDING_DECIDED",
          metadata: { decision: "EXECUTE_PROPOSED_ACTION" },
          summary: "Approved admin agent finding.",
        }),
      ),
    ).toBe("管理员已批准屏蔽 Agent 建议");

    expect(
      formatAuditSummary(
        createLog({
          action: "ADMIN_AGENT_TASK_RESUMED",
          metadata: { taskName: "comment_moderation_analysis" },
          resourceType: "ADMIN_AGENT_TASK",
          summary: "恢复 Agent 业务处理 comment_moderation_analysis",
        }),
      ),
    ).toBe("确认评论治理分析");
  });

  it("formats resource and client details without debug-heavy raw values", () => {
    const log = createLog({
      metadata: { source: "admin_agent" },
      resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
      resourceType: "article_comment",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
      ipAddress: "::ffff:127.0.0.1",
    });

    expect(formatAuditResourceLabel(log)).toBe("评论 / 77649607...");
    expect(formatAuditClientLabel(log)).toBe("Agent 工作台 · 浏览器 · 本机");
  });

  it("replaces internal orchestration fallback summaries", () => {
    expect(
      formatAuditSummary(
        createLog({
          action: "UNKNOWN_ADMIN_ACTION" as AdminOperationLogAction,
          summary: "Opened LangGraph 运行面板 for checkpoint threadId workflowName.",
        }),
      ),
    ).toBe("记录了一次后台操作");

    expect(
      formatAuditSummary(
        createLog({
          action: "UNKNOWN_ADMIN_ACTION" as AdminOperationLogAction,
          summary: "Opened /agent/runs/thread-1 runtime debug view.",
        }),
      ),
    ).toBe("记录了一次后台操作");
  });
});

function createLog(
  overrides: Partial<Parameters<typeof formatAuditSummary>[0]> = {},
): Parameters<typeof formatAuditSummary>[0] {
  return {
    action: "COMMENT_STATUS_UPDATED",
    actorLogin: "Adrian-Zephyr-Liao",
    createdAt: "2026-07-07T15:57:00.000Z",
    id: "log-1",
    ipAddress: null,
    metadata: null,
    resourceId: null,
    resourceType: "article_comment",
    summary: "Updated article comment status to HIDDEN",
    userAgent: null,
    ...overrides,
  };
}
