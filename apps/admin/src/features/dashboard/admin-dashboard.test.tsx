// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "./admin-dashboard";

const adminApiMocks = vi.hoisted(() => ({
  getAdminAgentHome: vi.fn(),
  listAdminArticleComments: vi.fn(),
  listAdminArticles: vi.fn(),
  listAdminGuestbookMessages: vi.fn(),
  listAdminOperationLogs: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("../../lib/admin-api", () => adminApiMocks);

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMocks.listAdminArticles
      .mockResolvedValueOnce({
        data: [createArticle()],
        pagination: { page: 1, pageSize: 5, totalItems: 12, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 1, totalItems: 3, totalPages: 3 },
      });
    adminApiMocks.getAdminAgentHome.mockResolvedValue({
      pendingFindingCount: 4,
      todayCommentCount: 7,
    });
    adminApiMocks.listAdminArticleComments.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
    });
    adminApiMocks.listAdminGuestbookMessages.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1 },
    });
    adminApiMocks.listAdminOperationLogs.mockResolvedValue({
      data: [createAuditLog()],
      pagination: { page: 1, pageSize: 5, totalItems: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("aggregates real admin APIs into an actionable operations overview", async () => {
    render(<AdminDashboard />);

    const metrics = await screen.findByLabelText("运营指标");

    expect(within(metrics).getByText("全部文章").parentElement?.textContent).toContain("12");
    expect(within(metrics).getByText("待完成草稿").parentElement?.textContent).toContain("3");
    expect(within(metrics).getByText("今日评论").parentElement?.textContent).toContain("7");
    expect(within(metrics).getByText("Agent 待确认").parentElement?.textContent).toContain("4");
    expect(screen.getByText("Markdown 语法全量展示")).not.toBeNull();
    expect(screen.getByText("更新文章《Markdown 语法全量展示》")).not.toBeNull();
    expect(screen.queryByText("更新文章 bb70e94b")).toBeNull();

    await waitFor(() => {
      expect(adminApiMocks.listAdminArticles).toHaveBeenNthCalledWith(1, {
        page: 1,
        pageSize: 5,
        status: "ALL",
      });
      expect(adminApiMocks.listAdminArticles).toHaveBeenNthCalledWith(2, {
        page: 1,
        pageSize: 1,
        status: "DRAFT",
      });
      expect(adminApiMocks.listAdminArticleComments).toHaveBeenCalledWith({
        page: 1,
        pageSize: 1,
        status: "HIDDEN",
      });
      expect(adminApiMocks.listAdminGuestbookMessages).toHaveBeenCalledWith({
        page: 1,
        pageSize: 1,
        status: "DELETED",
      });
      expect(adminApiMocks.listAdminOperationLogs).toHaveBeenCalledWith({
        action: "ALL",
        page: 1,
        pageSize: 5,
      });
    });
  });
});

function createArticle() {
  return {
    aiSummaryStatus: "READY",
    category: { name: "笔记", slug: "notes" },
    commentCount: 13,
    coverImageUrl: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    description: "完整展示 Markdown 语法。",
    id: "article-1",
    origin: "ORIGINAL",
    publishedAt: "2026-07-03T13:09:00.000Z",
    readingMinutes: 5,
    slug: "markdown-guide",
    source: null,
    status: "PUBLISHED",
    tags: [],
    title: "Markdown 语法全量展示",
    updatedAt: "2026-07-03T13:09:00.000Z",
    wordCount: 1553,
  };
}

function createAuditLog() {
  return {
    action: "ARTICLE_UPDATED",
    actorLogin: "Adrian-Zephyr-Liao",
    createdAt: "2026-07-13T01:17:00.000Z",
    id: "audit-1",
    ipAddress: "127.0.0.1",
    metadata: { articleSlug: "bb70e94b" },
    resourceId: "article-1",
    resourceType: "article",
    summary: "更新文章 bb70e94b",
    userAgent: "test",
  };
}
