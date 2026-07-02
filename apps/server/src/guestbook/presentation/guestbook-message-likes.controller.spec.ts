import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import {
  GuestbookMessageAuthenticationRequiredError,
  GuestbookMessageLikeTargetNotFoundError,
} from "../application/guestbook-message.errors";
import { LikeGuestbookMessageUseCase } from "../application/like-guestbook-message.use-case";
import { UnlikeGuestbookMessageUseCase } from "../application/unlike-guestbook-message.use-case";
import { GuestbookMessageLikesController } from "./guestbook-message-likes.controller";

describe("GuestbookMessageLikesController", () => {
  it("maps authentication failures to a 401 response", async () => {
    const likeGuestbookMessage = createLikeUseCaseDouble();
    likeGuestbookMessage.execute.mockRejectedValue(
      new GuestbookMessageAuthenticationRequiredError(),
    );
    const controller = new GuestbookMessageLikesController(
      likeGuestbookMessage,
      createUnlikeUseCaseDouble(),
      createCurrentUserUseCaseDouble(null),
    );

    await expect(controller.like("message-1", createRequestDouble())).rejects.toMatchObject({
      response: {
        error: {
          code: "AUTH_REQUIRED",
        },
      },
      status: 401,
    });
  });

  it("maps hidden or missing message targets to a 404 response", async () => {
    const likeGuestbookMessage = createLikeUseCaseDouble();
    likeGuestbookMessage.execute.mockRejectedValue(new GuestbookMessageLikeTargetNotFoundError());
    const controller = new GuestbookMessageLikesController(
      likeGuestbookMessage,
      createUnlikeUseCaseDouble(),
      createCurrentUserUseCaseDouble({ id: "user-1" }),
    );

    await expect(controller.like("message-1", createRequestDouble())).rejects.toMatchObject({
      response: {
        error: {
          code: "GUESTBOOK_MESSAGE_NOT_FOUND",
        },
      },
      status: 404,
    });
  });

  it("passes the current user into the unlike use case", async () => {
    const unlikeGuestbookMessage = createUnlikeUseCaseDouble();
    const controller = new GuestbookMessageLikesController(
      createLikeUseCaseDouble(),
      unlikeGuestbookMessage,
      createCurrentUserUseCaseDouble({ id: "user-1" }),
    );

    await controller.unlike("message-1", createRequestDouble());

    expect(unlikeGuestbookMessage.execute).toHaveBeenCalledWith({
      messageId: "message-1",
      user: { id: "user-1" },
    });
  });
});

function createLikeUseCaseDouble() {
  return {
    execute: vi.fn().mockResolvedValue({
      messageId: "message-1",
      likeCount: 1,
      likedByMe: true,
    }),
  } as unknown as LikeGuestbookMessageUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createUnlikeUseCaseDouble() {
  return {
    execute: vi.fn().mockResolvedValue({
      messageId: "message-1",
      likeCount: 0,
      likedByMe: false,
    }),
  } as unknown as UnlikeGuestbookMessageUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createCurrentUserUseCaseDouble(user: { id: string } | null) {
  return {
    execute: vi.fn().mockResolvedValue(user),
  } as unknown as GetCurrentUserUseCase;
}

function createRequestDouble() {
  return {
    headers: {
      cookie: "session=token",
    },
  } as unknown as Request;
}
