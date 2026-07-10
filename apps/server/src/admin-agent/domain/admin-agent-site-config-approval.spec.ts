import { describe, expect, it } from "vitest";
import { createSiteConfigApprovalRequest } from "./admin-agent-site-config-approval";

describe("admin agent site config approval", () => {
  it("creates a read-only site config review approval request", () => {
    expect(
      createSiteConfigApprovalRequest(
        {},
        {
          checkpointId: "checkpoint-1",
          issueCount: 0,
          workflow: "site_config_review",
        },
      ),
    ).toEqual({
      action: "REVIEW_SITE_CONFIG",
      payload: {
        output: {
          issueCount: 0,
        },
      },
      question: "是否确认这次站点配置巡检结果？",
      subject: "SITE_CONFIG",
      summary: "站点配置巡检需要管理员确认。",
    });
  });

  it("creates a write approval request for site announcements", () => {
    expect(
      createSiteConfigApprovalRequest(
        {
          actionPayload: {
            announcementId: "announcement-1",
            content: "发布维护公告",
          },
          proposedAction: "UPDATE_SITE_ANNOUNCEMENT",
        },
        {
          ignored: true,
        },
      ),
    ).toEqual({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      payload: {
        announcementId: "announcement-1",
        content: "发布维护公告",
      },
      question: "是否确认执行这次站点公告更新？",
      subject: "SITE_CONFIG",
      summary: "站点配置巡检需要管理员确认。",
    });
  });

  it("uses a safe empty payload when a write request has malformed action payload", () => {
    expect(
      createSiteConfigApprovalRequest(
        {
          actionPayload: ["invalid"],
          proposedAction: "UPDATE_SITE_ANNOUNCEMENT",
        },
        {
          workflow: "site_config_review",
        },
      ),
    ).toEqual({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      payload: {},
      question: "是否确认执行这次站点公告更新？",
      subject: "SITE_CONFIG",
      summary: "站点配置巡检需要管理员确认。",
    });
  });

  it("preserves caller-provided summary", () => {
    expect(createSiteConfigApprovalRequest({}, {}, "公告更新需要确认。").summary).toBe(
      "公告更新需要确认。",
    );
  });
});
