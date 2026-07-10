import { describe, expect, it } from "vitest";
import {
  createAdminAgentWorkflowEventSummary,
  toAdminAgentWorkflowNodeLabel,
} from "./admin-agent-workflow-summary";

describe("admin agent workflow summary", () => {
  it("formats lifecycle events in business language", () => {
    expect(
      createAdminAgentWorkflowEventSummary({
        eventType: "RUN_CREATED",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).toBe("评论治理分析任务已创建。");

    expect(
      createAdminAgentWorkflowEventSummary({
        attemptCount: 2,
        eventType: "RUN_ATTEMPT_STARTED",
        workflowName: "AUDIT_REVIEW",
      }),
    ).toBe("审计分析开始第 2 次执行。");

    expect(
      createAdminAgentWorkflowEventSummary({
        eventType: "RUN_RESUMED",
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    ).toBe("文章协作已从人工确认处继续执行。");

    expect(
      createAdminAgentWorkflowEventSummary({
        controlAction: "branch",
        eventType: "CONTROLLED",
        workflowName: "SITE_CONFIG_REVIEW",
      }),
    ).toBe("站点巡检已执行「另开处理」操作。");
  });

  it("formats node events without exposing implementation node names", () => {
    expect(toAdminAgentWorkflowNodeLabel("load_comments")).toBe("读取评论");
    expect(toAdminAgentWorkflowNodeLabel("request_multi_task_approval")).toBe("等待管理员确认");

    expect(
      createAdminAgentWorkflowEventSummary({
        eventType: "NODE_STARTED",
        node: "analyze_site_config",
        workflowName: "SITE_CONFIG_REVIEW",
      }),
    ).toBe("站点巡检进入「分析站点配置」步骤。");
  });
});
