import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type {
  ArticleCommentLikeRepository,
  ArticleCommentLikeState,
} from "../domain/article-comment-like.repository";

@Injectable()
class PrismaArticleCommentLikeRepository implements ArticleCommentLikeRepository {
  constructor(private readonly prisma: PrismaService) {}

  likeVisibleComment(commentId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.articleComment.findFirst({
        where: {
          id: commentId,
          status: "VISIBLE",
        },
        select: {
          id: true,
          likeCount: true,
        },
      });

      if (!comment) {
        return null;
      }

      const createdLike = await transaction.articleCommentLike.createMany({
        data: {
          commentId,
          userId,
        },
        skipDuplicates: true,
      });
      const likeCount =
        createdLike.count > 0
          ? (
              await transaction.articleComment.update({
                where: {
                  id: commentId,
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
          : comment.likeCount;

      return {
        commentId,
        likeCount,
        likedByMe: true,
      } satisfies ArticleCommentLikeState;
    });
  }

  unlikeVisibleComment(commentId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.articleComment.findFirst({
        where: {
          id: commentId,
          status: "VISIBLE",
        },
        select: {
          id: true,
          likeCount: true,
        },
      });

      if (!comment) {
        return null;
      }

      const deletedLike = await transaction.articleCommentLike.deleteMany({
        where: {
          commentId,
          userId,
        },
      });
      const likeCount =
        deletedLike.count > 0
          ? (
              await transaction.articleComment.update({
                where: {
                  id: commentId,
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
          : comment.likeCount;

      return {
        commentId,
        likeCount,
        likedByMe: false,
      } satisfies ArticleCommentLikeState;
    });
  }
}

export { PrismaArticleCommentLikeRepository };
