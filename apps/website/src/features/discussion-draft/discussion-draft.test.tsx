// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ArticleComments } from "../article-comments/article-comments";
import { useArticleComments } from "../article-comments/use-article-comments";
import { GuestbookBoard } from "../guestbook/guestbook-board";
import { useGuestbookBoard } from "../guestbook/use-guestbook-board";
import * as storage from "./draft-storage";
import { ApiRequestError } from "@/lib/api-client";

const api = vi.hoisted(() => ({
  loadArticleComments: vi.fn(),
  loadCurrentUser: vi.fn(),
  createArticleComment: vi.fn(),
  toggleArticleCommentLike: vi.fn(),
  logoutCurrentUser: vi.fn(),
  loadGuestbookMessages: vi.fn(),
  createGuestbookMessage: vi.fn(),
  toggleGuestbookMessageLike: vi.fn(),
}));
vi.mock("../article-comments/article-comment-api", () => api);
vi.mock("../guestbook/guestbook-api", () => api);
vi.mock("next/image", () => ({ default: () => null }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(storage, "navigateToLogin").mockImplementation(() => {});
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  api.loadArticleComments.mockResolvedValue(page());
  api.loadGuestbookMessages.mockResolvedValue(page());
  api.loadCurrentUser.mockResolvedValue(user);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("restores article drafts across remounts and isolates article keys without an empty overwrite", async () => {
  const first = renderHook(({ slug }) => useArticleComments(slug), {
    initialProps: { slug: "first" },
  });
  await waitFor(() => expect(first.result.current.initialLoadState).toBe("ready"));
  act(() => first.result.current.setBody("第一篇中文草稿"));
  first.rerender({ slug: "second" });
  await waitFor(() => expect(first.result.current.initialLoadState).toBe("ready"));
  expect(first.result.current.body).toBe("");
  act(() => first.result.current.setBody("第二篇草稿"));
  first.unmount();
  const back = renderHook(() => useArticleComments("first"));
  await waitFor(() => expect(back.result.current.body).toBe("第一篇中文草稿"));
  expect(api.createArticleComment).not.toHaveBeenCalled();
});
it("keeps nickname and body through an unsuccessful guestbook login and offers retry", async () => {
  const first = renderHook(() => useGuestbookBoard());
  await waitFor(() => expect(first.result.current.loadState).toBe("ready"));
  act(() => {
    first.result.current.setBody("留言未发");
    first.result.current.setGuestNickname("访客名字");
  });
  first.unmount();
  window.history.replaceState(null, "", "/comments?auth=failed");
  api.loadCurrentUser.mockResolvedValue(null);
  render(<GuestbookBoard />);
  await waitFor(() =>
    expect((screen.getByLabelText("留言内容") as HTMLTextAreaElement).value).toBe("留言未发"),
  );
  expect((screen.getByLabelText("昵称") as HTMLInputElement).value).toBe("访客名字");
  expect(screen.getByRole("alert").textContent).toContain("登录未完成");
  expect(screen.getByRole("button", { name: "重试登录" })).not.toBeNull();
});
it("retains an unresolved reply draft and blocks publication until explicitly made a new comment", async () => {
  api.loadArticleComments.mockResolvedValue(page([comment("parent")]));
  const first = renderHook(() => useArticleComments("first"));
  await waitFor(() => expect(first.result.current.initialLoadState).toBe("ready"));
  act(() => {
    first.result.current.replyToComment(comment("parent"));
    first.result.current.setBody("回复正文");
  });
  first.unmount();
  api.loadArticleComments.mockResolvedValue(page());
  render(<ArticleComments slug="first" />);
  await waitFor(() =>
    expect((screen.getByLabelText("评论内容") as HTMLTextAreaElement).value).toBe("回复正文"),
  );
  expect(screen.getByRole("alert").textContent).toContain("回复对象");
  expect((screen.getByRole("button", { name: "发布评论" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "作为新评论" }));
  api.createArticleComment.mockResolvedValue(comment("created"));
  fireEvent.click(screen.getByRole("button", { name: "发布评论" }));
  await waitFor(() =>
    expect(api.createArticleComment).toHaveBeenCalledWith(
      expect.objectContaining({ parentCommentId: null, body: "回复正文" }),
    ),
  );
});
it("never replaces new typing when the initial comments request settles", async () => {
  api.loadArticleComments.mockResolvedValueOnce(page([comment("parent")]));
  const first = renderHook(() => useArticleComments("first"));
  await waitFor(() => expect(first.result.current.initialLoadState).toBe("ready"));
  act(() => {
    first.result.current.replyToComment(comment("parent"));
    first.result.current.setBody("stored");
  });
  first.unmount();
  const read = deferred();
  api.loadArticleComments.mockReturnValueOnce(read.promise);
  const back = renderHook(() => useArticleComments("first"));
  act(() => back.result.current.setBody("new composition 中文"));
  await act(async () => read.resolve(page([comment("parent")])));
  expect(back.result.current.replyTarget?.id).toBe("parent");
  expect(back.result.current.body).toBe("new composition 中文");
});
it("a late old-article success cannot clear that article's later draft", async () => {
  const view = renderHook(({ slug }) => useArticleComments(slug), {
    initialProps: { slug: "first" },
  });
  await waitFor(() => expect(view.result.current.initialLoadState).toBe("ready"));
  act(() => view.result.current.setBody("sent first"));
  const write = deferred();
  api.createArticleComment.mockReturnValueOnce(write.promise);
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.submitComment();
  });
  view.rerender({ slug: "second" });
  await waitFor(() => expect(view.result.current.initialLoadState).toBe("ready"));
  act(() => view.result.current.setBody("keep second"));
  view.rerender({ slug: "first" });
  await waitFor(() => expect(view.result.current.initialLoadState).toBe("ready"));
  act(() => view.result.current.setBody("new first"));
  await act(async () => {
    write.resolve(comment("posted"));
    await pending;
  });
  expect(view.result.current.body).toBe("new first");
  view.unmount();
  const back = renderHook(() => useArticleComments("first"));
  await waitFor(() => expect(back.result.current.body).toBe("new first"));
});
it.each(["network", "4xx"])(
  "preserves guestbook draft after %s failure, clearing only confirmed success",
  async (failure) => {
    const view = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(view.result.current.loadState).toBe("ready"));
    act(() => {
      view.result.current.setBody("keep me");
      view.result.current.setGuestNickname("Visitor");
    });
    api.createGuestbookMessage.mockRejectedValueOnce(
      failure === "network" ? new Error("offline") : new ApiRequestError(400, null),
    );
    await act(async () => view.result.current.submitMessage());
    view.unmount();
    const back = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(back.result.current.body).toBe("keep me"));
    api.createGuestbookMessage.mockResolvedValueOnce({
      kind: "created",
      message: { id: "created" },
    });
    await act(async () => back.result.current.submitMessage());
    back.unmount();
    const cleared = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(cleared.result.current.loadState).toBe("ready"));
    expect(cleared.result.current.body).toBe("");
  },
);
it("blocks login when saving throws and exposes copy and retry without losing input", async () => {
  api.loadCurrentUser.mockResolvedValue(null);
  render(<GuestbookBoard />);
  await screen.findByText("这里还留着空白");
  vi.spyOn(Object.getPrototypeOf(window.sessionStorage), "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  fireEvent.change(screen.getByLabelText("留言内容"), { target: { value: "请保留这些字" } });
  fireEvent.click(screen.getByRole("button", { name: "登录" }));
  expect(screen.getByRole("alert").textContent).toContain("复制");
  expect((screen.getByLabelText("留言内容") as HTMLTextAreaElement).value).toBe("请保留这些字");
  expect(screen.getByRole("button", { name: "复制内容" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "重试保存" })).not.toBeNull();
});
it("saves the latest body synchronously before a 401 login redirect", async () => {
  const view = renderHook(() => useArticleComments("expired"));
  await waitFor(() => expect(view.result.current.initialLoadState).toBe("ready"));
  act(() => view.result.current.setBody("expired 中文草稿"));
  api.createArticleComment.mockRejectedValueOnce(new ApiRequestError(401, null));
  vi.mocked(storage.navigateToLogin).mockImplementation(() => {
    expect(window.sessionStorage.getItem(storage.draftKey("article:expired"))).toContain(
      "expired 中文草稿",
    );
  });
  await act(async () => view.result.current.submitComment());
  expect(storage.navigateToLogin).toHaveBeenCalledTimes(1);
  expect(api.createArticleComment).toHaveBeenCalledTimes(1);
  expect(view.result.current.body).toBe("expired 中文草稿");
});
it("keeps a 401 draft on the page when storage access itself is blocked", async () => {
  const view = renderHook(() => useArticleComments("expired"));
  await waitFor(() => expect(view.result.current.initialLoadState).toBe("ready"));
  act(() => view.result.current.setBody("not saved"));
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new Error("denied");
  });
  api.createArticleComment.mockRejectedValueOnce(new ApiRequestError(401, null));
  await act(async () => view.result.current.submitComment());
  expect(storage.navigateToLogin).not.toHaveBeenCalled();
  expect(view.result.current.body).toBe("not saved");
  expect(view.result.current.draft.storageError).toContain("先复制");
});
it("requires a fresh successful copy and an explicit continue before bypassing failed storage", async () => {
  api.loadCurrentUser.mockResolvedValue(null);
  render(<GuestbookBoard />);
  await screen.findByText("这里还留着空白");
  vi.spyOn(Object.getPrototypeOf(window.sessionStorage), "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  const body = screen.getByLabelText("留言内容");
  fireEvent.compositionStart(body);
  fireEvent.change(body, { target: { value: "正在输入中文" } });
  fireEvent.compositionEnd(body);
  fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "小林" } });
  fireEvent.click(screen.getByRole("button", { name: "登录" }));
  fireEvent.click(screen.getByRole("button", { name: "复制内容" }));
  await screen.findByRole("button", { name: "已复制，继续登录" });
  expect(copy).toHaveBeenLastCalledWith("昵称：小林\n\n正在输入中文");
  expect(storage.navigateToLogin).not.toHaveBeenCalled();
  fireEvent.change(body, { target: { value: "改过的正文" } });
  expect(screen.queryByRole("button", { name: "已复制，继续登录" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "复制内容" }));
  fireEvent.click(await screen.findByRole("button", { name: "已复制，继续登录" }));
  expect(storage.navigateToLogin).toHaveBeenCalledTimes(1);
  expect(api.createGuestbookMessage).not.toHaveBeenCalled();
});
it("retries saving without navigating or discarding the current input", async () => {
  api.loadCurrentUser.mockResolvedValue(null);
  render(<GuestbookBoard />);
  await screen.findByText("这里还留着空白");
  const write = vi
    .spyOn(Object.getPrototypeOf(window.sessionStorage), "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  fireEvent.change(screen.getByLabelText("留言内容"), { target: { value: "retry text" } });
  expect(screen.getByRole("alert").textContent).toContain("无法保存");
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(storage.navigateToLogin).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem(storage.draftKey("guestbook"))).toContain("retry text");
});

const user = {
  id: "author",
  githubId: "1",
  login: "author",
  name: null,
  avatarUrl: null,
  profileUrl: "https://example.test/author",
};
function comment(id: string) {
  return {
    id,
    body: id,
    author: user,
    parentCommentId: null,
    replies: [],
    likeCount: 0,
    likedByMe: false,
    createdAt: "2026-11-07T00:00:00Z",
    updatedAt: "2026-11-07T00:00:00Z",
  };
}
function page(data: unknown[] = []) {
  return { data, pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
