// @vitest-environment jsdom

import { StrictMode } from "react";
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
import type {
  AuthUserResponse,
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import { GuestbookBoard } from "./guestbook-board";
import { useGuestbookBoard } from "./use-guestbook-board";

vi.mock("next/image", () => ({ default: () => null }));

const listFetch = vi.fn<typeof fetch>();
let currentUser: AuthUserResponse | null = null;

beforeEach(() => {
  window.sessionStorage.clear();
  listFetch.mockReset();
  currentUser = null;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input, init) => {
      if (typeof input === "string" && input.startsWith("/api/guestbook/messages?"))
        return listFetch(input, init);
      return Promise.resolve(json({ user: currentUser }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("guestbook loading and recovery", () => {
  it("distinguishes loading and failure from an empty guestbook, then retries", async () => {
    const pending = deferred<Response>();
    listFetch.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(json(page("first")));
    render(<GuestbookBoard />);

    expect(screen.getByText("正在读取留言…")).toBeDefined();
    expect(screen.queryByText("这里还留着空白")).toBeNull();
    expect(screen.queryByText("0 条留言")).toBeNull();

    await act(async () => pending.reject(new Error("offline")));
    expect(screen.getByRole("alert").textContent).toContain("留言暂时无法读取");
    expect(screen.queryByText("这里还留着空白")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "重新加载留言" }));
    await waitFor(() => expect(screen.queryByText("first message")).not.toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("2 条留言")).toBeDefined();
  });

  it("shows the empty state only after a successful empty response", async () => {
    listFetch.mockResolvedValue(
      json({
        data: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    );
    render(<GuestbookBoard />);

    await waitFor(() => expect(screen.queryByText("这里还留着空白")).not.toBeNull());
    expect(screen.getByText("0 条留言")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("preserves a draft but prevents posting until the initial list is loaded", async () => {
    const initial = deferred<Response>();
    listFetch.mockReturnValue(initial.promise);
    render(<GuestbookBoard />);
    fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "Visitor" } });
    fireEvent.change(screen.getByLabelText("留言内容"), { target: { value: "My draft" } });
    expect((screen.getByRole("button", { name: "留下纸条" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("留言加载完成后即可发布，输入的内容会保留。")).toBeDefined();

    await act(async () => initial.resolve(json(page("first"))));
    expect((screen.getByLabelText("留言内容") as HTMLTextAreaElement).value).toBe("My draft");
    expect((screen.getByRole("button", { name: "留下纸条" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it.each(["network", "server", "invalid-json"] as const)(
    "keeps the draft and warns that the write result is unknown after a %s failure",
    async (failure) => {
      listFetch.mockResolvedValue(json(page("first")));
      const { result } = renderHook(() => useGuestbookBoard());
      await waitFor(() => expect(result.current.loadState).toBe("ready"));
      act(() => {
        result.current.setGuestNickname("Visitor");
        result.current.setBody("My draft");
      });
      if (failure === "network") vi.mocked(fetch).mockRejectedValueOnce(new Error("response lost"));
      else
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response("not JSON", { status: failure === "server" ? 503 : 200 }),
        );

      await act(async () => result.current.submitMessage());
      expect(result.current.errorMessage).toBe("发布结果尚未确认，请先核对已有留言后再试。");
      expect(result.current.body).toBe("My draft");
      expect(result.current.messages.map(({ id }) => id)).toEqual(["first"]);
    },
  );

  it("reports a known validation rejection without claiming an unknown result", async () => {
    listFetch.mockResolvedValue(json(page("first")));
    const { result } = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    act(() => {
      result.current.setGuestNickname("Visitor");
      result.current.setBody("My draft");
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await act(async () => result.current.submitMessage());
    expect(result.current.errorMessage).toBe("留言未发布，请检查内容或稍后重试。");
    expect(result.current.body).toBe("My draft");
  });

  it("keeps loaded messages and pagination when loading more fails, then retries the same page", async () => {
    listFetch
      .mockResolvedValueOnce(json(page("first")))
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }))
      .mockResolvedValueOnce(json(page("second", 2)));
    render(<GuestbookBoard />);
    await waitFor(() => expect(screen.queryByText("first message")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());
    expect(screen.getByText("first message")).toBeDefined();
    expect(screen.getByText("2 条留言")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "重试加载更多" }));
    await waitFor(() => expect(screen.queryByText("second message")).not.toBeNull());
    expect(screen.getByText("first message")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
    expect(listFetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/guestbook/messages?page=1&pageSize=20",
      "/api/guestbook/messages?page=2&pageSize=20",
      "/api/guestbook/messages?page=2&pageSize=20",
    ]);
  });

  it("ignores an aborted initial response after Strict Mode restarts the effect", async () => {
    const old = deferred<Response>();
    listFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(json(page("new")));
    const { result } = renderHook(() => useGuestbookBoard(), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(listFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    await act(async () => old.resolve(json(page("old"))));
    expect(result.current.messages.map(({ id }) => id)).toEqual(["new"]);
    expect(result.current.pagination?.totalItems).toBe(2);
  });

  it("aborts an in-flight next page when leaving the guestbook", async () => {
    const pending = deferred<Response>();
    listFetch.mockResolvedValueOnce(json(page("first"))).mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.loadMore();
    });
    expect(listFetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(false);

    unmount();
    expect(listFetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(json(page("second", 2)));
      await loading;
    });
  });

  it("sends only one write when submit is invoked twice before React rerenders", async () => {
    listFetch.mockResolvedValue(json(page("first")));
    const { result } = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    act(() => {
      result.current.setGuestNickname("Visitor");
      result.current.setBody("One message");
    });
    const created = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(created.promise);
    let submitted!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      submitted = result.current.submitMessage();
      duplicate = result.current.submitMessage();
    });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      1,
    );

    await act(async () => {
      created.resolve(json(page("created").data[0]));
      await Promise.all([submitted, duplicate]);
    });
    expect(result.current.messages.map(({ id }) => id)).toEqual(["created", "first"]);
    expect(result.current.pagination?.totalItems).toBe(3);
  });

  it("keeps a new visit's draft and list when an old submission finishes after leaving", async () => {
    listFetch.mockResolvedValueOnce(json(page("old"))).mockResolvedValueOnce(json(page("current")));
    const old = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(old.result.current.loadState).toBe("ready"));
    act(() => {
      old.result.current.setGuestNickname("Visitor");
      old.result.current.setBody("Old draft");
    });
    const created = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(created.promise);
    let submitted!: Promise<void>;
    act(() => {
      submitted = old.result.current.submitMessage();
    });
    const writeOptions = vi.mocked(fetch).mock.calls.at(-1)?.[1];
    expect(writeOptions?.signal).toBeUndefined();
    old.unmount();

    const current = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(current.result.current.loadState).toBe("ready"));
    act(() => current.result.current.setBody("Current draft"));
    await act(async () => {
      created.resolve(json(page("late").data[0]));
      await submitted;
    });
    expect(current.result.current.body).toBe("Current draft");
    expect(current.result.current.messages.map(({ id }) => id)).toEqual(["current"]);
    expect(current.result.current.errorMessage).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      1,
    );
  });

  it("deduplicates a pending like and does not redirect a different page on a late 401", async () => {
    currentUser = {
      id: "user",
      githubId: "123",
      login: "visitor",
      name: "Visitor",
      avatarUrl: null,
      profileUrl: "https://github.com/visitor",
    };
    listFetch.mockResolvedValue(json(page("first")));
    const { result, unmount } = renderHook(() => useGuestbookBoard());
    await waitFor(() => expect(result.current.user?.id).toBe("user"));
    const liked = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(liked.promise);
    let pending!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      pending = result.current.toggleLike(result.current.messages[0]!);
      duplicate = result.current.toggleLike(result.current.messages[0]!);
    });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(
      1,
    );
    unmount();
    const nextPage = { href: "https://example.test/another-page" };
    vi.stubGlobal("window", { location: nextPage });
    await act(async () => {
      liked.resolve(new Response("{}", { status: 401 }));
      await Promise.all([pending, duplicate]);
    });
    expect(nextPage.href).toBe("https://example.test/another-page");
  });
});

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
}

function page(id: string, pageNumber = 1): GuestbookMessagesResponse {
  const message: GuestbookMessageResponse = {
    id,
    body: `${id} message`,
    author: { type: "GUEST", nickname: "Visitor", avatarSeed: "visitor" },
    likeCount: 0,
    likedByMe: false,
    createdAt: "2026-11-06T12:00:00.000Z",
    updatedAt: "2026-11-06T12:00:00.000Z",
  };
  return {
    data: [message],
    pagination: { page: pageNumber, pageSize: 20, totalItems: 2, totalPages: 2 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
