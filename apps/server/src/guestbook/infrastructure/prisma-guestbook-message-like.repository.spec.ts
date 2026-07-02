import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../database/prisma.service";
import { PrismaGuestbookMessageLikeRepository } from "./prisma-guestbook-message-like.repository";

describe("PrismaGuestbookMessageLikeRepository", () => {
  it("increments the message like count only when a like is newly created", async () => {
    const transaction = createTransactionDouble({
      createLikeCount: 1,
      messageLikeCount: 3,
      updatedLikeCount: 4,
    });
    const repository = new PrismaGuestbookMessageLikeRepository(createPrismaDouble(transaction));

    await expect(repository.likeVisibleMessage("message-1", "user-1")).resolves.toEqual({
      messageId: "message-1",
      likeCount: 4,
      likedByMe: true,
    });
    expect(transaction.guestbookMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          likeCount: {
            increment: 1,
          },
        },
      }),
    );
  });

  it("keeps the current count when liking an already-liked message", async () => {
    const transaction = createTransactionDouble({
      createLikeCount: 0,
      messageLikeCount: 3,
      updatedLikeCount: 4,
    });
    const repository = new PrismaGuestbookMessageLikeRepository(createPrismaDouble(transaction));

    await expect(repository.likeVisibleMessage("message-1", "user-1")).resolves.toEqual({
      messageId: "message-1",
      likeCount: 3,
      likedByMe: true,
    });
    expect(transaction.guestbookMessage.update).not.toHaveBeenCalled();
  });

  it("returns null without writing likes when the message is not visible", async () => {
    const transaction = createTransactionDouble({
      createLikeCount: 1,
      messageLikeCount: null,
      updatedLikeCount: 4,
    });
    const repository = new PrismaGuestbookMessageLikeRepository(createPrismaDouble(transaction));

    await expect(repository.likeVisibleMessage("message-1", "user-1")).resolves.toBeNull();
    expect(transaction.guestbookMessageLike.createMany).not.toHaveBeenCalled();
    expect(transaction.guestbookMessage.update).not.toHaveBeenCalled();
  });

  it("decrements the message like count only when a like is removed", async () => {
    const transaction = createTransactionDouble({
      deleteLikeCount: 1,
      messageLikeCount: 3,
      updatedLikeCount: 2,
    });
    const repository = new PrismaGuestbookMessageLikeRepository(createPrismaDouble(transaction));

    await expect(repository.unlikeVisibleMessage("message-1", "user-1")).resolves.toEqual({
      messageId: "message-1",
      likeCount: 2,
      likedByMe: false,
    });
    expect(transaction.guestbookMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      }),
    );
  });

  it("keeps the current count when unliking a message that was not liked", async () => {
    const transaction = createTransactionDouble({
      deleteLikeCount: 0,
      messageLikeCount: 3,
      updatedLikeCount: 2,
    });
    const repository = new PrismaGuestbookMessageLikeRepository(createPrismaDouble(transaction));

    await expect(repository.unlikeVisibleMessage("message-1", "user-1")).resolves.toEqual({
      messageId: "message-1",
      likeCount: 3,
      likedByMe: false,
    });
    expect(transaction.guestbookMessage.update).not.toHaveBeenCalled();
  });
});

function createPrismaDouble(transaction: GuestbookLikeTransactionDouble) {
  return {
    $transaction: (callback: (transaction: GuestbookLikeTransactionDouble) => unknown) =>
      callback(transaction),
  } as unknown as PrismaService;
}

function createTransactionDouble({
  createLikeCount = 0,
  deleteLikeCount = 0,
  messageLikeCount,
  updatedLikeCount,
}: {
  createLikeCount?: number;
  deleteLikeCount?: number;
  messageLikeCount: number | null;
  updatedLikeCount: number;
}) {
  return {
    guestbookMessage: {
      findFirst: vi.fn().mockResolvedValue(
        messageLikeCount === null
          ? null
          : {
              id: "message-1",
              likeCount: messageLikeCount,
            },
      ),
      update: vi.fn().mockResolvedValue({
        likeCount: updatedLikeCount,
      }),
    },
    guestbookMessageLike: {
      createMany: vi.fn().mockResolvedValue({
        count: createLikeCount,
      }),
      deleteMany: vi.fn().mockResolvedValue({
        count: deleteLikeCount,
      }),
    },
  };
}

type GuestbookLikeTransactionDouble = ReturnType<typeof createTransactionDouble>;
