import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type {
  GuestbookMessageLikeRepository,
  GuestbookMessageLikeState,
} from "../domain/guestbook-message-like.repository";

@Injectable()
class PrismaGuestbookMessageLikeRepository implements GuestbookMessageLikeRepository {
  constructor(private readonly prisma: PrismaService) {}

  likeVisibleMessage(messageId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.guestbookMessage.findFirst({
        where: {
          id: messageId,
          status: "VISIBLE",
        },
        select: {
          id: true,
          likeCount: true,
        },
      });

      if (!message) {
        return null;
      }

      const createdLike = await transaction.guestbookMessageLike.createMany({
        data: {
          messageId,
          userId,
        },
        skipDuplicates: true,
      });
      const likeCount =
        createdLike.count > 0
          ? (
              await transaction.guestbookMessage.update({
                where: {
                  id: messageId,
                },
                data: {
                  likeCount: {
                    increment: 1,
                  },
                },
                select: {
                  likeCount: true,
                },
              })
            ).likeCount
          : message.likeCount;

      return {
        messageId,
        likeCount,
        likedByMe: true,
      } satisfies GuestbookMessageLikeState;
    });
  }

  unlikeVisibleMessage(messageId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.guestbookMessage.findFirst({
        where: {
          id: messageId,
          status: "VISIBLE",
        },
        select: {
          id: true,
          likeCount: true,
        },
      });

      if (!message) {
        return null;
      }

      const deletedLike = await transaction.guestbookMessageLike.deleteMany({
        where: {
          messageId,
          userId,
        },
      });
      const likeCount =
        deletedLike.count > 0
          ? (
              await transaction.guestbookMessage.update({
                where: {
                  id: messageId,
                },
                data: {
                  likeCount: {
                    decrement: 1,
                  },
                },
                select: {
                  likeCount: true,
                },
              })
            ).likeCount
          : message.likeCount;

      return {
        messageId,
        likeCount,
        likedByMe: false,
      } satisfies GuestbookMessageLikeState;
    });
  }
}

export { PrismaGuestbookMessageLikeRepository };
