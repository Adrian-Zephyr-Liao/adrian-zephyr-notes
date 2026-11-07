// @vitest-environment jsdom

import type {
  AdminArticleListQuery,
  AdminArticleListResponse,
} from "@adrian-zephyr-notes/contracts";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleManagement } from "./article-management";

const api = vi.hoisted(() => ({
  listAdminArticles: vi.fn<(query: AdminArticleListQuery) => Promise<AdminArticleListResponse>>(),
}));
vi.mock("../../lib/admin-api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

beforeEach(() => {
  vi.resetAllMocks();
  api.listAdminArticles.mockResolvedValue(response("初始文章"));
});
afterEach(cleanup);

describe("article filter request ordering", () => {
  it.each(["resolve", "reject"] as const)(
    "ignores an older search %s after the latest filter has loaded",
    async (outcome) => {
      render(<ArticleManagement />);
      await screen.findByText("初始文章");
      const old = deferred<AdminArticleListResponse>();
      const latest = deferred<AdminArticleListResponse>();
      api.listAdminArticles.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
      search("草稿");
      search("已发布");
      await act(async () => latest.resolve(response("最新筛选文章")));
      expect(screen.getByText("最新筛选文章")).not.toBeNull();
      await act(async () => {
        if (outcome === "resolve") old.resolve(response("过期筛选文章", 7, 9));
        else old.reject(new Error("old search failed"));
      });
      expect(screen.getByText("最新筛选文章")).not.toBeNull();
      expect(screen.queryByText("过期筛选文章")).toBeNull();
      expect(screen.getByText("第 1 / 2 页")).not.toBeNull();
      expect((screen.getByRole("textbox", { name: "搜索文章" }) as HTMLInputElement).value).toBe(
        "已发布",
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(api.listAdminArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "已发布" }),
      );
    },
  );

  it.each(["resolve", "reject"] as const)(
    "keeps the current request loading when an earlier search %s settles",
    async (outcome) => {
      render(<ArticleManagement />);
      await screen.findByText("初始文章");
      const old = deferred<AdminArticleListResponse>();
      const latest = deferred<AdminArticleListResponse>();
      api.listAdminArticles.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
      search("草稿");
      search("已发布");
      await act(async () => {
        if (outcome === "resolve") old.resolve(response("过期筛选文章"));
        else old.reject(new Error("old search failed"));
      });
      expect(screen.getByLabelText("正在加载文章")).not.toBeNull();
      expect(screen.getByRole("button", { name: "刷新文章" }).hasAttribute("disabled")).toBe(true);
      expect(screen.queryByRole("alert")).toBeNull();
      await act(async () => latest.resolve(response("最新筛选文章")));
      expect(screen.getByText("最新筛选文章")).not.toBeNull();
      expect(screen.getByRole("button", { name: "刷新文章" }).hasAttribute("disabled")).toBe(false);
    },
  );

  it("ignores a stale refresh failure and still exposes a current request failure for retry", async () => {
    render(<ArticleManagement />);
    await screen.findByText("初始文章");
    const refresh = deferred<AdminArticleListResponse>();
    api.listAdminArticles.mockReturnValueOnce(refresh.promise);
    fireEvent.click(screen.getByRole("button", { name: "刷新文章" }));
    api.listAdminArticles.mockResolvedValueOnce(response("筛选后的文章"));
    search("新条件");
    await screen.findByText("筛选后的文章");
    await act(async () => refresh.reject(new Error("old refresh failed")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("筛选后的文章")).not.toBeNull();
    api.listAdminArticles.mockRejectedValueOnce(new Error("current refresh failed"));
    fireEvent.click(screen.getByRole("button", { name: "刷新文章" }));
    expect((await screen.findByRole("alert")).textContent).toContain("文章列表加载失败");
    api.listAdminArticles.mockResolvedValueOnce(response("重试后的文章"));
    fireEvent.click(screen.getByRole("button", { name: "刷新文章" }));
    await screen.findByText("重试后的文章");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.listAdminArticles).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "新条件" }),
    );
  });
});

it("applies global search when the same article route receives a new query", async () => {
  const view = render(<ArticleManagement searchQuery="first query" />);
  await screen.findByText("初始文章");
  expect(api.listAdminArticles).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: "first query" }),
  );
  const pending = deferred<AdminArticleListResponse>();
  api.listAdminArticles.mockReturnValueOnce(pending.promise);
  view.rerender(<ArticleManagement searchQuery="updated query" />);
  expect((screen.getByRole("textbox", { name: "搜索文章" }) as HTMLInputElement).value).toBe(
    "updated query",
  );
  expect(api.listAdminArticles).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: "updated query", page: 1 }),
  );
  await act(async () => pending.resolve(response("全局搜索结果")));
  expect(screen.getByText("全局搜索结果")).not.toBeNull();
});

it("returns to a previous global query after local search updates the route", async () => {
  function RoutedSearch() {
    const [q, setQ] = useState("global A");
    return (
      <>
        <button onClick={() => setQ("global A")}>搜索 global A</button>
        <ArticleManagement searchQuery={q} onSearchSubmit={setQ} />
      </>
    );
  }
  render(<RoutedSearch />);
  await screen.findByText("初始文章");
  api.listAdminArticles.mockResolvedValueOnce(response("本地 B 结果"));
  search("local B");
  await screen.findByText("本地 B 结果");
  expect(api.listAdminArticles).toHaveBeenLastCalledWith(expect.objectContaining({ q: "local B" }));
  api.listAdminArticles.mockResolvedValueOnce(response("全局 A 结果"));
  fireEvent.click(screen.getByRole("button", { name: "搜索 global A" }));
  await screen.findByText("全局 A 结果");
  expect(api.listAdminArticles).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: "global A" }),
  );
  expect((screen.getByRole("textbox", { name: "搜索文章" }) as HTMLInputElement).value).toBe(
    "global A",
  );
});

it("labels the server-filtered total as matching articles", async () => {
  const initial = response("初始文章");
  initial.pagination.totalItems = 12;
  api.listAdminArticles.mockResolvedValueOnce(initial);
  render(<ArticleManagement />);
  await screen.findByText("初始文章");
  expect(screen.getByText("匹配文章").nextElementSibling?.textContent).toBe("12");
  const filtered = response("符合搜索的文章");
  filtered.pagination.totalItems = 3;
  api.listAdminArticles.mockResolvedValueOnce(filtered);
  search("搜索条件");
  await screen.findByText("符合搜索的文章");
  expect(screen.getByText("匹配文章").nextElementSibling?.textContent).toBe("3");
  expect(screen.queryByText("全部文章")).toBeNull();
  expect(api.listAdminArticles).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: "搜索条件" }),
  );
});

it("uses the associated cover and replaces a failed image with a clear placeholder", async () => {
  const payload = response("带封面文章");
  payload.data[0].coverImageUrl = "https://img.zephyrai.site/fixture/cover.jpg";
  api.listAdminArticles.mockResolvedValueOnce(payload);
  const view = render(<ArticleManagement />);
  await screen.findByText("带封面文章");
  const image = view.container.querySelector("img");
  expect(image?.getAttribute("src")).toBe(payload.data[0].coverImageUrl);
  fireEvent.error(image!);
  expect(screen.getByRole("img", { name: "封面不可用" })).not.toBeNull();
});

it("reports failed reads without empty results or zero statistics and retries", async () => {
  api.listAdminArticles.mockRejectedValueOnce(new Error("offline"));
  const view = render(<ArticleManagement />);
  await screen.findByRole("alert");
  expect(screen.queryByText("没有符合条件的文章")).toBeNull();
  expect([...view.container.querySelectorAll("dd")].map((node) => node.textContent)).toEqual([
    "—",
    "—",
    "—",
    "—",
  ]);
  expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
  api.listAdminArticles.mockResolvedValueOnce(response("恢复的文章"));
  fireEvent.click(screen.getByRole("button", { name: "重试加载文章" }));
  await screen.findByText("恢复的文章");
  expect(screen.queryByRole("alert")).toBeNull();
});

function search(value: string) {
  const input = screen.getByRole("textbox", { name: "搜索文章" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(title: string, page = 1, totalPages = 2): AdminArticleListResponse {
  return {
    data: [
      {
        aiSummaryStatus: "READY",
        category: null,
        commentCount: 0,
        coverImageUrl: null,
        createdAt: "2026-11-06T00:00:00.000Z",
        description: "文章摘要",
        id: title,
        origin: "ORIGINAL",
        publishedAt: "2026-11-06T00:00:00.000Z",
        readingMinutes: 5,
        slug: "test-note",
        source: null,
        status: "PUBLISHED",
        tags: [],
        title,
        updatedAt: "2026-11-06T00:00:00.000Z",
        wordCount: 1000,
      },
    ],
    pagination: { page, pageSize: 12, totalItems: 13, totalPages },
  };
}
