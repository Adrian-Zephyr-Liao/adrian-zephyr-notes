// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { AdminApiError } from "../../lib/admin-http";
import { CommentModeration } from "../comments/comment-moderation";
import { GuestbookModeration } from "../guestbook/guestbook-moderation";
import { useModerationList } from "./use-moderation-list";

const api = vi.hoisted(() => ({
  listAdminArticleComments: vi.fn(),
  updateAdminArticleComment: vi.fn(),
  listAdminGuestbookMessages: vi.fn(),
  updateAdminGuestbookMessage: vi.fn(),
}));
vi.mock("../../lib/admin-api", () => api);
// Exercise the page workflows with a native control; Radix interaction is covered by browser QA.
vi.mock("../../components/ui/select", () => ({
  Select: (props: ComponentProps<"select">) => <select {...props} />,
}));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

for (const config of [
  {
    name: "comments",
    Component: CommentModeration,
    list: api.listAdminArticleComments,
    update: api.updateAdminArticleComment,
    loading: "正在加载评论...",
    search: "搜索评论、作者、文章",
    confirmation: "隐藏评论",
  },
  {
    name: "guestbook",
    Component: GuestbookModeration,
    list: api.listAdminGuestbookMessages,
    update: api.updateAdminGuestbookMessage,
    loading: "正在加载留言...",
    search: "搜索留言、昵称、用户",
    confirmation: "隐藏留言",
  },
]) {
  describe(`${config.name} moderation consistency`, () => {
    beforeEach(() => {
      config.list.mockResolvedValue(page([item("initial")]));
      config.update.mockResolvedValue(item("initial", "HIDDEN"));
    });
    const mount = async () => {
      render(<config.Component />);
      await screen.findByText("initial");
    };
    const search = (value: string) => {
      fireEvent.change(screen.getByPlaceholderText(config.search), { target: { value } });
      fireEvent.keyDown(screen.getByPlaceholderText(config.search), { key: "Enter" });
    };
    const hide = async () => {
      fireEvent.click(screen.getByRole("button", { name: "隐藏" }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: config.confirmation }));
    };

    it.each(["resolve", "reject"])(
      "ignores old %s after the latest filter has loaded",
      async (outcome) => {
        await mount();
        const old = deferred();
        const latest = deferred();
        config.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
        search("old");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "HIDDEN" } });
        await act(async () => latest.resolve(page([item("latest", "HIDDEN")], 1, 7)));
        await act(async () =>
          outcome === "resolve"
            ? old.resolve(page([item("stale")], 3, 30))
            : old.reject(new Error("stale failure")),
        );
        expect(screen.getByText("latest")).not.toBeNull();
        expect(screen.queryByText("stale")).toBeNull();
        expect(screen.getByText("7 条")).not.toBeNull();
        expect(screen.getByText("第 1 / 1 页")).not.toBeNull();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(config.list).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: "old", status: "HIDDEN" }),
        );
      },
    );

    it.each(["resolve", "reject"])(
      "old %s cannot finish the current loading state",
      async (outcome) => {
        await mount();
        const old = deferred();
        const latest = deferred();
        config.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
        fireEvent.click(screen.getByRole("button", { name: "刷新" }));
        search("latest");
        expect(screen.queryByText("initial")).toBeNull();
        expect(screen.queryByText("1 条")).toBeNull();
        expect(screen.queryByRole("button", { name: "隐藏" })).toBeNull();
        await act(async () =>
          outcome === "resolve"
            ? old.resolve(page([item("stale")]))
            : old.reject(new Error("stale failure")),
        );
        expect(screen.getByText(config.loading)).not.toBeNull();
        expect(screen.getByRole("region", { name: "审核结果" }).getAttribute("aria-busy")).toBe(
          "true",
        );
        expect(screen.queryByRole("alert")).toBeNull();
        await act(async () => latest.resolve(page([item("latest")])));
        expect(screen.getByText("latest")).not.toBeNull();
      },
    );

    it("refreshes a current failure without exposing the previous query's rows", async () => {
      await mount();
      config.list.mockRejectedValueOnce(new Error("offline"));
      search("failed");
      expect((await screen.findByRole("alert")).textContent).toContain("列表加载失败");
      expect(screen.queryByText("initial")).toBeNull();
      expect(screen.queryByText("1 条")).toBeNull();
      expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
      config.list.mockResolvedValueOnce(page([item("recovered")]));
      fireEvent.click(screen.getByRole("button", { name: "刷新" }));
      await screen.findByText("recovered");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "failed" }));
    });

    it("keeps search and status when paging and refreshing rapidly", async () => {
      await mount();
      config.list.mockResolvedValue(page([item("matching")], 1, 21));
      search("needle");
      await screen.findByText("matching");
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "VISIBLE" } });
      await waitFor(() =>
        expect(config.list).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: "needle", status: "VISIBLE", page: 1 }),
        ),
      );
      await screen.findByText("matching");
      const old = deferred();
      const refresh = deferred();
      config.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(refresh.promise);
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
      fireEvent.click(screen.getByRole("button", { name: "刷新" }));
      await act(async () => refresh.resolve(page([item("page-two")], 2, 21)));
      await act(async () => old.resolve(page([item("stale-page")], 2, 21)));
      expect(screen.getByText("page-two")).not.toBeNull();
      expect(screen.queryByText("stale-page")).toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "needle", status: "VISIBLE", page: 2 }),
      );
    });

    it("re-reads the visible filter after hiding and updates the count to zero", async () => {
      await mount();
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "VISIBLE" } });
      await screen.findByText("initial");
      config.list.mockResolvedValueOnce(page([]));
      await hide();
      await screen.findByText("0 条");
      expect(screen.queryByText("initial")).toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "VISIBLE", page: 1 }),
      );
      expect(config.update).toHaveBeenCalledTimes(1);
    });

    it("removes restored records from the hidden filter and re-reads its count", async () => {
      config.list.mockResolvedValue(page([item("restore", "HIDDEN")]));
      config.update.mockResolvedValue(item("restore"));
      render(<config.Component />);
      await screen.findByText("restore");
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "HIDDEN" } });
      await screen.findByText("restore");
      config.list.mockResolvedValueOnce(page([]));
      fireEvent.click(screen.getByRole("button", { name: "恢复" }));
      await screen.findByText("0 条");
      expect(screen.queryByText("restore")).toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "HIDDEN" }));
      expect(config.update).toHaveBeenCalledWith("restore", { status: "VISIBLE" });
    });

    it("keeps ALL records after a confirmed change and uses the server count", async () => {
      await mount();
      config.list.mockResolvedValueOnce(page([item("updated", "HIDDEN")], 1, 4));
      await hide();
      await screen.findByText("updated");
      expect(screen.getByText("4 条")).not.toBeNull();
      expect(screen.getByRole("button", { name: "恢复" })).not.toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ALL" }));
    });

    it("moves from the removed last page to the last valid page", async () => {
      await mount();
      config.list.mockResolvedValueOnce(page([item("initial")], 1, 11));
      fireEvent.click(screen.getByRole("button", { name: "刷新" }));
      await screen.findByText("第 1 / 2 页");
      config.list.mockResolvedValueOnce(page([item("last")], 2, 11));
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
      await screen.findByText("last");
      config.list
        .mockResolvedValueOnce(page([], 2, 10))
        .mockResolvedValueOnce(page([item("previous-page")], 1, 10));
      await hide();
      await screen.findByText("previous-page");
      expect(screen.getByText("第 1 / 1 页")).not.toBeNull();
      expect(screen.getByText("10 条")).not.toBeNull();
      expect(config.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    });

    it("distinguishes a committed write from a failed read and retries only the read", async () => {
      await mount();
      config.list.mockRejectedValueOnce(new Error("refresh offline"));
      await hide();
      expect((await screen.findByRole("alert")).textContent).toBe(
        "操作已成功，列表刷新失败，请刷新查看最新结果。",
      );
      expect(screen.queryByText("initial")).toBeNull();
      expect(screen.queryByRole("button", { name: "恢复" })).toBeNull();
      config.list.mockResolvedValueOnce(page([item("confirmed", "HIDDEN")]));
      fireEvent.click(screen.getByRole("button", { name: "刷新" }));
      await screen.findByText("confirmed");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(config.update).toHaveBeenCalledTimes(1);
    });

    it.each(["resolve", "reject"])(
      "handles a late mutation %s after switching queries",
      async (outcome) => {
        await mount();
        const write = deferred();
        config.update.mockReturnValueOnce(write.promise);
        await hide();
        config.list.mockResolvedValueOnce(page([item("new-filter", "HIDDEN")]));
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "HIDDEN" } });
        await screen.findByText("new-filter");
        const read = deferred();
        config.list.mockReturnValueOnce(read.promise);
        await act(async () =>
          outcome === "resolve"
            ? write.resolve(item("wrong-old-row", "HIDDEN"))
            : write.reject(new Error("old write failed")),
        );
        expect(screen.queryByText("wrong-old-row")).toBeNull();
        if (outcome === "resolve") {
          expect(config.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: "HIDDEN" }),
          );
          expect(screen.queryByText("new-filter")).toBeNull();
          await act(async () => read.resolve(page([item("authoritative", "HIDDEN")])));
          expect(screen.getByText("authoritative")).not.toBeNull();
        } else {
          expect(screen.getByText("new-filter")).not.toBeNull();
          expect(screen.queryByRole("alert")).toBeNull();
        }
      },
    );

    it("prevents repeated writes and keeps the lock until the read settles", async () => {
      await mount();
      const write = deferred();
      const read = deferred();
      config.update.mockReturnValueOnce(write.promise);
      config.list.mockReturnValueOnce(read.promise);
      await hide();
      expect(screen.getByText("处理中")).not.toBeNull();
      const button = screen.getByText("处理中").closest("article")!.querySelector("button")!;
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
      expect(config.update).toHaveBeenCalledTimes(1);
      await act(async () => write.resolve(item("initial", "HIDDEN")));
      expect(screen.queryByRole("button", { name: "隐藏" })).toBeNull();
      await act(async () => read.resolve(page([item("reloaded", "HIDDEN")])));
      expect(screen.getByRole("button", { name: "恢复" }).hasAttribute("disabled")).toBe(false);
    });

    it.each([
      new Error("response lost"),
      new AdminApiError("upstream failed", 500),
      new SyntaxError("invalid JSON"),
    ])("requires verification of an unknown write outcome without retrying: %s", async (error) => {
      await mount();
      config.update.mockRejectedValueOnce(error);
      const reads = config.list.mock.calls.length;
      await hide();
      expect((await screen.findByRole("alert")).textContent).toBe(
        "操作结果尚未确认，请刷新核对后再试。",
      );
      expect(screen.queryByText("initial")).toBeNull();
      expect(config.update).toHaveBeenCalledTimes(1);
      expect(config.list).toHaveBeenCalledTimes(reads);
      config.list.mockResolvedValueOnce(page([item("verified", "HIDDEN")]));
      fireEvent.click(screen.getByRole("button", { name: "刷新" }));
      await screen.findByText("verified");
      expect(config.update).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("reports a known rejected write without implying success", async () => {
      await mount();
      config.update.mockRejectedValueOnce(new AdminApiError("not allowed", 403));
      const reads = config.list.mock.calls.length;
      await hide();
      expect((await screen.findByRole("alert")).textContent).toContain("状态更新失败");
      expect(screen.getByText("initial")).not.toBeNull();
      expect(config.list).toHaveBeenCalledTimes(reads);
      expect(screen.getByRole("button", { name: "隐藏" }).hasAttribute("disabled")).toBe(false);
    });

    it("cancels confirmation without writing and releases the operation lock", async () => {
      await mount();
      fireEvent.click(screen.getByRole("button", { name: "隐藏" }));
      fireEvent.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "取消" }),
      );
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(config.update).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "隐藏" }).hasAttribute("disabled")).toBe(false);
    });

    it("keeps new query ownership when an older post-write read fails", async () => {
      await mount();
      const read = deferred();
      config.list.mockReturnValueOnce(read.promise);
      await hide();
      await waitFor(() => expect(config.list).toHaveBeenCalledTimes(2));
      config.list.mockResolvedValueOnce(page([item("latest-query", "HIDDEN")]));
      search("latest");
      await screen.findByText("latest-query");
      await act(async () => read.reject(new Error("old refresh failed")));
      expect(screen.getByText("latest-query")).not.toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("ignores a read failure after the page unmounts", async () => {
      const read = deferred();
      config.list.mockReturnValueOnce(read.promise);
      const view = render(<config.Component />);
      view.unmount();
      await act(async () => read.reject(new Error("late read failure")));
      expect(config.list).toHaveBeenCalledTimes(1);
    });

    it("does not reload or publish a failure after unmounting during a write", async () => {
      const view = render(<config.Component />);
      await screen.findByText("initial");
      const write = deferred();
      config.update.mockReturnValueOnce(write.promise);
      await hide();
      const reads = config.list.mock.calls.length;
      view.unmount();
      await act(async () => write.resolve(item("late")));
      expect(config.list).toHaveBeenCalledTimes(reads);
    });
  });
}

it("locks duplicate mutation calls before React renders the pending state", async () => {
  const list = vi.fn().mockResolvedValue(page([item("initial")]));
  const write = deferred();
  const update = vi.fn().mockReturnValue(write.promise);
  const { result } = renderHook(() =>
    useModerationList({
      initialQuery: { page: 1, pageSize: 10 },
      list,
      loadError: "read failed",
      updateError: "write failed",
    }),
  );
  await waitFor(() => expect(result.current.isReady).toBe(true));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.mutate("initial", update);
    void result.current.mutate("initial", update);
  });
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    write.resolve(item("initial"));
    await pending;
  });
  expect(list).toHaveBeenCalledTimes(2);
});

describe("guestbook-specific moderation", () => {
  it.each(["DELETED", "HIDDEN"])("restores %s messages using the active filter", async (status) => {
    api.listAdminGuestbookMessages.mockResolvedValue(page([item("restore", status)]));
    api.updateAdminGuestbookMessage.mockResolvedValue(item("restore"));
    render(<GuestbookModeration />);
    await screen.findByText("restore");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: status } });
    await screen.findByText("restore");
    api.listAdminGuestbookMessages.mockResolvedValueOnce(page([]));
    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    await screen.findByText("0 条");
    expect(api.updateAdminGuestbookMessage).toHaveBeenCalledWith("restore", { status: "VISIBLE" });
  });

  it("re-reads after deleting and pinning to preserve membership and server order", async () => {
    api.listAdminGuestbookMessages.mockResolvedValue(page([item("first"), item("second")]));
    api.updateAdminGuestbookMessage.mockResolvedValue(item("second"));
    render(<GuestbookModeration />);
    await screen.findByText("second");
    api.listAdminGuestbookMessages.mockResolvedValueOnce(
      page([{ ...item("second"), isPinned: true }, item("first")]),
    );
    fireEvent.click(
      within(screen.getByText("second").closest("article")!).getByRole("button", {
        name: "置顶",
      }),
    );
    await waitFor(() => expect(screen.getAllByRole("article")[0].textContent).toContain("second"));
    api.listAdminGuestbookMessages.mockResolvedValueOnce(page([item("first")]));
    fireEvent.click(
      within(screen.getByText("second").closest("article")!).getByRole("button", {
        name: "删除",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "删除留言" }),
    );
    await screen.findByText("1 条");
    expect(screen.queryByText("second")).toBeNull();
    expect(api.updateAdminGuestbookMessage).toHaveBeenLastCalledWith("second", {
      status: "DELETED",
    });
  });
});

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
function item(body: string, status = "VISIBLE") {
  return {
    id: body,
    body,
    status,
    author: {
      type: "GITHUB",
      id: "author",
      login: "reviewer",
      name: null,
      avatarUrl: null,
      profileUrl: "https://example.test/reviewer",
    },
    article: { id: "article", title: "An article", slug: "article" },
    parent: null,
    parentCommentId: null,
    replyCount: 0,
    likeCount: 0,
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    guestFingerprint: null,
    isPinned: false,
    pinnedAt: null,
  };
}
function page(data: ReturnType<typeof item>[], current = 1, total = data.length) {
  return {
    data,
    pagination: {
      page: current,
      pageSize: 10,
      totalItems: total,
      totalPages: Math.ceil(total / 10),
    },
  };
}
