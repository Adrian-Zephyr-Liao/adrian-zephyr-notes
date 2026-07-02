import { describe, expect, it, vi } from "vitest";
import type { GuestbookMessageLikeRepository } from "../domain/guestbook-message-like.repository";
import {
  GuestbookMessageAuthenticationRequiredError,
  GuestbookMessageLikeTargetNotFoundError,
} from "./guestbook-message.errors";
import { LikeGuestbookMessageUseCase } from "./like-guestbook-message.use-case";
import { UnlikeGuestbookMessageUseCase } from "./unlike-guestbook-message.use-case";

describe("LikeGuestbookMessageUseCase", () => {
  it("requires an authenticated user before liking guestbook messages", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new LikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageAuthenticationRequiredError);
    expect(repository.likeVisibleMessage).not.toHaveBeenCalled();
  });

  it("returns the current like state after liking a visible message", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new LikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).resolves.toEqual({
      messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 12,
      likedByMe: true,
    });
  });

  it("rejects liking messages that are not visible", async () => {
    const repository = createLikeRepositoryDouble();
    repository.likeVisibleMessage.mockResolvedValue(null);
    const useCase = new LikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageLikeTargetNotFoundError);
  });
});

describe("UnlikeGuestbookMessageUseCase", () => {
  it("requires an authenticated user before unliking guestbook messages", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new UnlikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageAuthenticationRequiredError);
    expect(repository.unlikeVisibleMessage).not.toHaveBeenCalled();
  });

  it("returns the current like state after unliking a visible message", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new UnlikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).resolves.toEqual({
      messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 11,
      likedByMe: false,
    });
  });

  it("rejects unliking messages that are not visible", async () => {
    const repository = createLikeRepositoryDouble();
    repository.unlikeVisibleMessage.mockResolvedValue(null);
    const useCase = new UnlikeGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageLikeTargetNotFoundError);
  });
});

function createLikeRepositoryDouble() {
  return {
    likeVisibleMessage: vi.fn().mockResolvedValue({
      messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 12,
      likedByMe: true,
    }),
    unlikeVisibleMessage: vi.fn().mockResolvedValue({
      messageId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 11,
      likedByMe: false,
    }),
  } as unknown as GuestbookMessageLikeRepository & {
    likeVisibleMessage: ReturnType<typeof vi.fn>;
    unlikeVisibleMessage: ReturnType<typeof vi.fn>;
  };
}
