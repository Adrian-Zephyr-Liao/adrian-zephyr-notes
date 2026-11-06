// @vitest-environment jsdom

import type { GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestbookMessageList } from "./guestbook-message-list";

afterEach(cleanup);

describe("guestbook like button names", () => {
  it("includes the visible count and updates the action when the message is liked", () => {
    const onToggleLike = vi.fn();
    const props = {
      canLoadMore: false,
      isLoadingMore: false,
      loadState: "ready" as const,
      loadMoreError: null,
      likingMessageIds: new Set<string>(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
      onToggleLike,
      totalItems: 1,
    };
    const message: GuestbookMessageResponse = {
      id: "guest-message",
      body: "A note from a visitor",
      author: { type: "GUEST", nickname: "Visitor", avatarSeed: "visitor" },
      likeCount: 0,
      likedByMe: false,
      createdAt: "2026-11-06T12:00:00.000Z",
      updatedAt: "2026-11-06T12:00:00.000Z",
    };
    const page = render(<GuestbookMessageList {...props} messages={[message]} />);
    const like = screen.getByRole("button", { name: "给 Visitor 的留言点赞，当前 0 个赞" });
    expect(like.textContent).toBe("0");
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    expect(onToggleLike).toHaveBeenCalledWith(message);

    const liked = { ...message, likeCount: 1, likedByMe: true };
    page.rerender(<GuestbookMessageList {...props} messages={[liked]} />);
    const unlike = screen.getByRole("button", { name: "取消给 Visitor 的留言点赞，当前 1 个赞" });
    expect(unlike.textContent).toBe("1");
    expect(unlike.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(unlike);
    expect(onToggleLike).toHaveBeenLastCalledWith(liked);

    page.rerender(
      <GuestbookMessageList
        {...props}
        likingMessageIds={new Set([message.id])}
        messages={[liked]}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "取消给 Visitor 的留言点赞，当前 1 个赞",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
