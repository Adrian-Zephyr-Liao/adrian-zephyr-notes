// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type {
  AdminOperationLogAction,
  AdminOperationLogListResponse,
} from "@adrian-zephyr-notes/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogManagement } from "./audit-log-management";

const adminApiMocks = vi.hoisted(() => ({ listAdminOperationLogs: vi.fn() }));
vi.mock("../../lib/admin-api", () => adminApiMocks);

describe("AuditLogManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMocks.listAdminOperationLogs.mockResolvedValue(createAuditLogResponse());
  });
  afterEach(cleanup);

  it("presents ordinary moderation and article audit records", async () => {
    render(<AuditLogManagement />);
    expect(await screen.findByText("评论已设为已隐藏")).not.toBeNull();
    expect(screen.getByText("评论状态")).not.toBeNull();
    expect(screen.getByText("更新文章 《测试文章》")).not.toBeNull();
    expect(screen.getByText("同步审计投影")).not.toBeNull();
    expect(screen.getByText("管理后台 · 接口调用 · 本机")).not.toBeNull();
    await waitFor(() =>
      expect(adminApiMocks.listAdminOperationLogs).toHaveBeenCalledWith({
        action: "ALL",
        page: 1,
        pageSize: 10,
      }),
    );
  });
});

function createAuditLogResponse(): AdminOperationLogListResponse {
  return {
    data: [
      {
        action: "COMMENT_STATUS_UPDATED",
        actorLogin: "reviewer",
        createdAt: "2026-07-07T15:55:00.000Z",
        id: "audit-1",
        ipAddress: "127.0.0.1",
        metadata: { status: "HIDDEN" },
        resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
        resourceType: "article_comment",
        summary: "Updated article comment status to HIDDEN",
        userAgent: "curl/8.0.0",
      },
      {
        action: "ARTICLE_UPDATED",
        actorLogin: "editor",
        createdAt: "2026-07-07T15:55:01.000Z",
        id: "audit-2",
        ipAddress: null,
        metadata: { articleTitle: "测试文章" },
        resourceId: "article-1",
        resourceType: "article",
        summary: "Updated article",
        userAgent: null,
      },
      {
        action: "UNKNOWN_ADMIN_ACTION" as AdminOperationLogAction,
        actorLogin: "reviewer",
        createdAt: "2026-07-07T15:55:02.000Z",
        id: "audit-3",
        ipAddress: null,
        metadata: null,
        resourceId: null,
        resourceType: "site_settings",
        summary: "同步审计投影",
        userAgent: null,
      },
    ],
    pagination: { page: 1, pageSize: 10, totalItems: 3, totalPages: 1 },
  };
}
