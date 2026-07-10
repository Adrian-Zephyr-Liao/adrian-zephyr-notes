import { describe, expect, it } from "vitest";
import {
  createAdminAgentWorkflowCancelledEvent,
  createAdminAgentWorkflowCompletedEvent,
  createAdminAgentWorkflowFailedEvent,
  createAdminAgentWorkflowInterruptedEvent,
  createAdminAgentWorkflowNodeStartedEvent,
  createAdminAgentWorkflowRunAttemptEvent,
  createAdminAgentWorkflowRunCreatedEvent,
} from "./admin-agent-workflow-lifecycle";

describe("admin agent workflow lifecycle events", () => {
  it("creates a business-facing run-created event", () => {
    expect(
      createAdminAgentWorkflowRunCreatedEvent({
        dedupeKey: "comment:today",
        input: { scope: "today" },
        metadata: { graph: "commentModerationWorkflow" },
        parentRunId: null,
        parentRunRelation: null,
        runId: "run-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).toEqual({
      payload: {
        dedupeKey: "comment:today",
        input: { scope: "today" },
        metadata: { graph: "commentModerationWorkflow" },
        parentRunId: null,
        parentRunRelation: null,
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      runId: "run-1",
      summary: "评论治理分析任务已创建。",
      type: "RUN_CREATED",
    });
  });

  it("creates attempt and resume events from run lifecycle state", () => {
    expect(
      createAdminAgentWorkflowRunAttemptEvent({
        attemptCount: 2,
        resumed: false,
        runId: "run-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).toMatchObject({
      payload: { attemptCount: 2, resumed: false },
      summary: "审计分析开始第 2 次执行。",
      type: "RUN_ATTEMPT_STARTED",
    });

    expect(
      createAdminAgentWorkflowRunAttemptEvent({
        attemptCount: 3,
        resumed: true,
        runId: "run-1",
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    ).toMatchObject({
      payload: { attemptCount: 3, resumed: true },
      summary: "文章协作已从人工确认处继续执行。",
      type: "RUN_RESUMED",
    });
  });

  it("creates node, interruption, completion and failure events", () => {
    expect(
      createAdminAgentWorkflowNodeStartedEvent({
        node: "analyze_site_config",
        payload: { socialLinkCount: 2 },
        runId: "run-1",
        workflowName: "SITE_CONFIG_REVIEW",
      }),
    ).toEqual({
      node: "analyze_site_config",
      payload: { socialLinkCount: 2 },
      runId: "run-1",
      summary: "站点巡检进入「分析站点配置」步骤。",
      type: "NODE_STARTED",
    });

    expect(
      createAdminAgentWorkflowInterruptedEvent({
        approvalNode: "request_multi_task_approval",
        interruption: { kind: "ADMIN_AGENT_APPROVAL" },
        runId: "run-1",
        summary: "等待管理员确认。",
      }),
    ).toEqual({
      node: "request_multi_task_approval",
      payload: { interruption: { kind: "ADMIN_AGENT_APPROVAL" } },
      runId: "run-1",
      summary: "等待管理员确认。",
      type: "INTERRUPTED",
    });

    expect(
      createAdminAgentWorkflowCompletedEvent({
        runId: "run-1",
        summary: "任务完成。",
      }),
    ).toEqual({
      node: "completed",
      runId: "run-1",
      summary: "任务完成。",
      type: "COMPLETED",
    });

    expect(
      createAdminAgentWorkflowCancelledEvent({
        runId: "run-1",
        summary: "已取消评论治理分析。",
      }),
    ).toEqual({
      node: "cancelled",
      payload: null,
      runId: "run-1",
      summary: "已取消评论治理分析。",
      type: "CANCELLED",
    });

    expect(
      createAdminAgentWorkflowFailedEvent({
        errorMessage: "LLM failed",
        runId: "run-1",
      }),
    ).toEqual({
      node: "failed",
      payload: { errorMessage: "LLM failed" },
      runId: "run-1",
      summary: "LLM failed",
      type: "FAILED",
    });
  });
});
