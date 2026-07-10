import { describe, expect, it } from "vitest";
import { createAdminOperationSummary } from "./admin-operation-summary";

describe("createAdminOperationSummary", () => {
  it("formats comment moderation summaries from metadata", () => {
    expect(
      createAdminOperationSummary({
        action: "COMMENT_STATUS_UPDATED",
        metadata: { status: "HIDDEN" },
        resourceType: "article_comment",
      }),
    ).toBe("评论已设为已隐藏");

    expect(
      createAdminOperationSummary({
        action: "COMMENT_STATUS_UPDATED",
        metadata: { status: "VISIBLE" },
        resourceType: "article_comment",
      }),
    ).toBe("评论已设为可见");
  });

  it("formats agent decision summaries without implementation details", () => {
    expect(
      createAdminOperationSummary({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        metadata: { decision: "EXECUTE_PROPOSED_ACTION" },
        resourceType: "article_comment",
      }),
    ).toBe("管理员已批准屏蔽 Agent 建议");

    expect(
      createAdminOperationSummary({
        action: "ADMIN_AGENT_FINDING_CREATED",
        metadata: { findingCount: 3 },
        resourceType: "article_comment",
      }),
    ).toBe("Agent 生成 3 条风险建议");
  });

  it("formats agent task lifecycle summaries without runtime details", () => {
    expect(
      createAdminOperationSummary({
        action: "ADMIN_AGENT_TASK_STARTED",
        metadata: { taskName: "comment_moderation_analysis", taskTitle: "评论治理分析" },
        resourceId: "run-1",
        resourceType: "ADMIN_AGENT_TASK",
      }),
    ).toBe("发起评论治理分析");

    expect(
      createAdminOperationSummary({
        action: "ADMIN_AGENT_TASK_CONTROLLED",
        metadata: { action: "retry", taskName: "comment_moderation_analysis" },
        resourceId: "run-1",
        resourceType: "ADMIN_AGENT_TASK",
      }),
    ).toBe("重新处理评论治理分析");

    expect(
      createAdminOperationSummary({
        action: "ADMIN_AGENT_TASK_RESUMED",
        metadata: { taskTitle: "评论治理分析" },
        resourceId: "run-1",
        resourceType: "ADMIN_AGENT_TASK",
      }),
    ).toBe("确认评论治理分析");
  });

  it("formats content and site operation summaries", () => {
    expect(
      createAdminOperationSummary({
        action: "ARTICLE_CREATED",
        metadata: { slug: "markdown-guide" },
        resourceType: "article",
      }),
    ).toBe("创建文章 markdown-guide");
    expect(
      createAdminOperationSummary({
        action: "SITE_ANNOUNCEMENT_UPDATED",
        metadata: { key: "welcome" },
        resourceType: "site_announcement",
      }),
    ).toBe("更新站点公告 welcome");
    expect(
      createAdminOperationSummary({
        action: "SITE_SETTINGS_UPDATED",
        resourceType: "site_settings",
      }),
    ).toBe("更新站点配置");
  });
});
