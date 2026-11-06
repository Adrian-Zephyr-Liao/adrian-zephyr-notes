// @vitest-environment jsdom

import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleComments } from "./article-comments";
import { useArticleComments } from "./use-article-comments";

const api = vi.hoisted(() => ({
  loadArticleComments: vi.fn<() => Promise<ArticleCommentsResponse>>(),
  loadCurrentUser: vi.fn<() => Promise<AuthUserResponse | null>>(),
  createArticleComment: vi.fn<() => Promise<ArticleCommentResponse>>(),
  toggleArticleCommentLike: vi.fn(),
  logoutCurrentUser: vi.fn(),
}));
vi.mock("./article-comment-api", () => api);

beforeEach(() => {
  vi.resetAllMocks();
  api.loadArticleComments.mockResolvedValue(page());
  api.loadCurrentUser.mockResolvedValue(null);
});
afterEach(cleanup);

describe("article comment loading", () => {
  it("distinguishes loading and read failures from an empty list and retries from the visible control", async () => {
    const initial = deferred<ArticleCommentsResponse>();
    api.loadArticleComments.mockReturnValueOnce(initial.promise);
    render(<ArticleComments slug="first" />);
    expect(screen.getByRole("status").textContent).toContain("正在加载评论");
    expect(screen.queryByText("还没有评论")).toBeNull();
    await act(async () => initial.reject(new Error("offline")));
    expect(screen.getByRole("alert").textContent).toBe("评论加载失败，请重试。");
    expect(screen.queryByText("还没有评论")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新加载评论" }));
    await screen.findByText("还没有评论");
    expect(api.loadArticleComments).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retains the loaded page after a pagination error and retries the same next page", async () => {
    api.loadArticleComments.mockResolvedValueOnce(page([comment("first")], 1, 2));
    const { result } = renderHook(() => useArticleComments("first"));
    await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
    api.loadArticleComments.mockRejectedValueOnce(new Error("offline"));
    await act(async () => result.current.loadMore());
    expect(result.current.comments.map((item) => item.id)).toEqual(["first"]);
    expect(result.current.pagination?.page).toBe(1);
    expect(result.current.canLoadMore).toBe(true);
    expect(result.current.loadErrorMessage).toBe("加载更多评论失败，请重试。");
    api.loadArticleComments.mockResolvedValueOnce(page([comment("second")], 2, 2));
    await act(async () => result.current.loadMore());
    expect(api.loadArticleComments).toHaveBeenLastCalledWith("first", 2, 20);
    expect(result.current.comments.map((item) => item.id)).toEqual(["first", "second"]);
    expect(result.current.loadErrorMessage).toBeNull();
    expect(result.current.canLoadMore).toBe(false);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores an old initial request %s after changing articles",
    async (outcome) => {
      const old = deferred<ArticleCommentsResponse>();
      api.loadArticleComments.mockReturnValueOnce(old.promise);
      const { result, rerender } = renderHook(({ slug }) => useArticleComments(slug), {
        initialProps: { slug: "old" },
      });
      api.loadArticleComments.mockResolvedValueOnce(page([comment("new")]));
      rerender({ slug: "new" });
      await waitFor(() => expect(result.current.comments[0]?.id).toBe("new"));
      await act(async () => {
        if (outcome === "resolve") old.resolve(page([comment("old")]));
        else old.reject(new Error("old failed"));
      });
      expect(result.current.comments.map((item) => item.id)).toEqual(["new"]);
      expect(result.current.initialLoadState).toBe("ready");
      expect(result.current.loadErrorMessage).toBeNull();
    },
  );

  it("ignores old pagination after navigating away and returning to the same slug", async () => {
    api.loadArticleComments.mockResolvedValueOnce(page([comment("old")], 1, 2));
    const { result, rerender } = renderHook(({ slug }) => useArticleComments(slug), {
      initialProps: { slug: "first" },
    });
    await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
    const more = deferred<ArticleCommentsResponse>();
    api.loadArticleComments.mockReturnValueOnce(more.promise);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    rerender({ slug: "other" });
    await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
    api.loadArticleComments.mockResolvedValueOnce(page([comment("fresh")]));
    rerender({ slug: "first" });
    await waitFor(() => expect(result.current.comments[0]?.id).toBe("fresh"));
    await act(async () => {
      more.resolve(page([comment("late")], 2, 2));
      await pending;
    });
    expect(result.current.comments.map((item) => item.id)).toEqual(["fresh"]);
    expect(result.current.pagination?.page).toBe(1);
  });

  it.each(["resolve", "reject"] as const)(
    "does not apply an old submission %s to a newly opened article",
    async (outcome) => {
      api.loadCurrentUser.mockResolvedValue(user);
      const { result, rerender } = renderHook(({ slug }) => useArticleComments(slug), {
        initialProps: { slug: "first" },
      });
      await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
      const created = deferred<ArticleCommentResponse>();
      api.createArticleComment.mockReturnValueOnce(created.promise);
      act(() => result.current.setBody("first draft"));
      let submitted!: Promise<void>;
      act(() => {
        submitted = result.current.submitComment();
      });
      rerender({ slug: "second" });
      await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
      act(() => result.current.setBody("second draft"));
      await act(async () => {
        if (outcome === "resolve") created.resolve(comment("old-submission"));
        else created.reject(new Error("lost response"));
        await submitted;
      });
      expect(result.current.comments).toEqual([]);
      expect(result.current.body).toBe("second draft");
      expect(result.current.errorMessage).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
    },
  );

  it("waits for the initial discussion read before permitting publication", async () => {
    const initial = deferred<ArticleCommentsResponse>();
    api.loadArticleComments.mockReturnValueOnce(initial.promise);
    api.loadCurrentUser.mockResolvedValue(user);
    const { result } = renderHook(() => useArticleComments("first"));
    await waitFor(() => expect(result.current.user).toEqual(user));
    act(() => result.current.setBody("keep this while loading"));
    await act(async () => result.current.submitComment());
    expect(api.createArticleComment).not.toHaveBeenCalled();
    await act(async () => initial.resolve(page([comment("existing")])));
    api.createArticleComment.mockResolvedValueOnce(comment("new"));
    await act(async () => result.current.submitComment());
    expect(result.current.comments.map((item) => item.id)).toEqual(["existing", "new"]);
    expect(result.current.pagination?.totalItems).toBe(2);
  });

  it("keeps the selected reply fixed while its submission is pending", async () => {
    api.loadCurrentUser.mockResolvedValue(user);
    const { result } = renderHook(() => useArticleComments("first"));
    await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
    act(() => {
      result.current.replyToComment(comment("original"));
      result.current.setBody("reply body");
    });
    const created = deferred<ArticleCommentResponse>();
    api.createArticleComment.mockReturnValueOnce(created.promise);
    let submitted!: Promise<void>;
    act(() => {
      submitted = result.current.submitComment();
    });
    act(() => {
      result.current.replyToComment(comment("other"));
      result.current.cancelReply();
    });
    expect(result.current.replyTarget?.id).toBe("original");
    await act(async () => {
      created.resolve({ ...comment("created"), parentCommentId: "original" });
      await submitted;
    });
    expect(result.current.replyTarget).toBeNull();
  });

  it("preserves a draft and reports an unknown publication outcome without retrying the write", async () => {
    api.loadCurrentUser.mockResolvedValue(user);
    const { result } = renderHook(() => useArticleComments("first"));
    await waitFor(() => expect(result.current.initialLoadState).toBe("ready"));
    act(() => result.current.setBody("please keep this draft"));
    api.createArticleComment.mockRejectedValueOnce(new Error("response lost"));
    await act(async () => result.current.submitComment());
    expect(result.current.body).toBe("please keep this draft");
    expect(result.current.errorMessage).toBe("发布结果尚未确认，请刷新页面核对评论后再试。");
    expect(api.createArticleComment).toHaveBeenCalledTimes(1);
    expect(result.current.comments).toEqual([]);
  });

  it("allows an in-flight read to settle after unmount without an unhandled rejection", async () => {
    const initial = deferred<ArticleCommentsResponse>();
    api.loadArticleComments.mockReturnValueOnce(initial.promise);
    const { unmount } = renderHook(() => useArticleComments("first"));
    unmount();
    await act(async () => initial.reject(new Error("late network failure")));
    expect(api.loadArticleComments).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
const user: AuthUserResponse = {
  id: "author",
  githubId: "123",
  login: "author",
  name: null,
  avatarUrl: null,
  profileUrl: "https://github.com/author",
};
function comment(id: string): ArticleCommentResponse {
  return {
    id,
    body: `${id} body`,
    parentCommentId: null,
    author: user,
    replies: [],
    likeCount: 0,
    likedByMe: false,
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
  };
}
function page(
  data: ArticleCommentResponse[] = [],
  current = 1,
  totalPages = 1,
): ArticleCommentsResponse {
  return { data, pagination: { page: current, pageSize: 20, totalItems: data.length, totalPages } };
}
