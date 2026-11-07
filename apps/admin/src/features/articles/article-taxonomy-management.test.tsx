// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleCategoryManagement } from "./article-category-management";
import { ArticleTagManagement } from "./article-tag-management";

const api = vi.hoisted(() => ({
  listAdminArticleCategories: vi.fn(),
  listAdminArticleTags: vi.fn(),
  createAdminArticleCategory: vi.fn(),
  updateAdminArticleCategory: vi.fn(),
  deleteAdminArticleCategory: vi.fn(),
  createAdminArticleTag: vi.fn(),
  updateAdminArticleTag: vi.fn(),
  deleteAdminArticleTag: vi.fn(),
  mergeAdminArticleTag: vi.fn(),
}));
vi.mock("../../lib/admin-api", () => ({ ...api, AdminApiError: class extends Error {} }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  const response = {
    data: [{ id: "item", name: "旅行", slug: "travel", description: "记录", articleCount: 2 }],
    pagination: { page: 1, totalItems: 1, totalPages: 1 },
  };
  api.listAdminArticleCategories.mockResolvedValue(response);
  api.listAdminArticleTags.mockResolvedValue(response);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  { name: "分类", Component: ArticleCategoryManagement, load: api.listAdminArticleCategories },
  { name: "标签", Component: ArticleTagManagement, load: api.listAdminArticleTags },
])("$name list presentation", ({ name, Component, load }) => {
  it("opens a labeled edit form and returns focus on cancel", async () => {
    render(<Component />);
    const edit = await screen.findByRole("button", { name: "编辑旅行" });
    expect(screen.queryByLabelText(`${name}名称`)).toBeNull();
    edit.focus();
    fireEvent.click(edit);
    const input = screen.getByLabelText(`${name}名称`) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.value).toBe("旅行");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(document.activeElement).toBe(edit));
    expect(screen.queryByLabelText(`${name}名称`)).toBeNull();
  });
  it("distinguishes failed reads from an empty list and allows retry", async () => {
    load.mockRejectedValueOnce(new Error("offline"));
    render(<Component />);
    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.queryByText(`暂无文章${name}。`)).toBeNull();
    expect(screen.queryByText("0 个")).toBeNull();
    expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `刷新${name}` }));
    expect(await screen.findByText("旅行")).not.toBeNull();
  });
});
