import { describe, expect, it } from "vitest";
import type { GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";

import {
  appendUniqueGuestbookMessages,
  applyGuestbookMessageLikeState,
  prependGuestbookMessage,
} from "./guestbook-message-state";

const baseMessage = {
  body: "hello",
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  likeCount: 0,
  likedByMe: false,
  author: {
    type: "GUEST",
    nickname: "访客",
    avatarSeed: "guest",
  },
} satisfies Omit<GuestbookMessageResponse, "id">;

describe("guestbook message state", () => {
  it("applies like state to the matching message only", () => {
    const messages: GuestbookMessageResponse[] = [
      { ...baseMessage, id: "first" },
      { ...baseMessage, id: "second" },
    ];

    expect(
      applyGuestbookMessageLikeState(messages, {
        messageId: "second",
        likeCount: 7,
        likedByMe: true,
      }),
    ).toEqual([
      { ...baseMessage, id: "first" },
      { ...baseMessage, id: "second", likeCount: 7, likedByMe: true },
    ]);
  });

  it("prepends a new message without duplicating it", () => {
    const message = { ...baseMessage, id: "first" };

    expect(prependGuestbookMessage([message], message)).toEqual([message]);
    expect(prependGuestbookMessage([], message)).toEqual([message]);
  });

  it("appends only messages that are not already loaded", () => {
    const first = { ...baseMessage, id: "first" };
    const second = { ...baseMessage, id: "second" };

    expect(appendUniqueGuestbookMessages([first], [first, second])).toEqual([first, second]);
  });
});
