import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type {
  ArticleCommentRepository,
  ArticleCommentsListInput,
  CreateArticleCommentInput,
} from "../domain/article-comment.repository";
import {
  articleCommentInclude,
  type ArticleCommentRecord,
  type ArticleCommentTreeRecord,
} from "./article-comments.mapper";

@Injectable()
class PrismaArticleCommentRepository implements ArticleCommentRepository<
  ArticleCommentRecord,
  ArticleCommentTreeRecord
> {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicArticleIdBySlug(slug: string, now: Date) {
    const article = await this.prisma.article.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
    });

    return article?.id ?? null;
  }

  async findVisibleCommentArticleIdById(commentId: string) {
    const comment = await this.prisma.articleComment.findFirst({
      where: {
        id: commentId,
        status: "VISIBLE",
      },
      select: {
        articleId: true,
      },
    });

    return comment?.articleId ?? null;
  }

  async listVisibleByArticleId(articleId: string, input: ArticleCommentsListInput) {
    const where = {
      articleId,
      parentCommentId: null,
      status: "VISIBLE" as const,
    };
    const [rootComments, totalItems] = await this.prisma.$transaction([
      this.prisma.articleComment.findMany({
        where,
        include: articleCommentInclude,
        orderBy: {
          createdAt: "asc",
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.articleComment.count({ where }),
    ]);
    const descendantComments = await this.listVisibleDescendantsByParentIds(
      articleId,
      rootComments.map((comment) => comment.id),
    );

    return {
      data: buildCommentTree(rootComments, descendantComments),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  create(input: CreateArticleCommentInput) {
    return this.prisma.articleComment.create({
      data: input,
      include: articleCommentInclude,
    });
  }

  private async listVisibleDescendantsByParentIds(articleId: string, parentCommentIds: string[]) {
    const descendants: ArticleCommentRecord[] = [];
    const visitedCommentIds = new Set(parentCommentIds);
    let nextParentCommentIds = parentCommentIds;

    while (nextParentCommentIds.length > 0) {
      const childComments = await this.prisma.articleComment.findMany({
        where: {
          articleId,
          parentCommentId: {
            in: nextParentCommentIds,
          },
          status: "VISIBLE",
        },
        include: articleCommentInclude,
        orderBy: {
          createdAt: "asc",
        },
      });
      const unvisitedChildComments = childComments.filter(
        (comment) => !visitedCommentIds.has(comment.id),
      );

      for (const comment of unvisitedChildComments) {
        visitedCommentIds.add(comment.id);
      }

      descendants.push(...unvisitedChildComments);
      nextParentCommentIds = unvisitedChildComments.map((comment) => comment.id);
    }

    return descendants;
  }
}

function buildCommentTree(
  rootComments: ArticleCommentRecord[],
  descendantComments: ArticleCommentRecord[],
) {
  const commentsById = new Map<string, ArticleCommentTreeRecord>();

  for (const comment of [...rootComments, ...descendantComments]) {
    commentsById.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  for (const comment of descendantComments) {
    const parentComment = comment.parentCommentId
      ? commentsById.get(comment.parentCommentId)
      : undefined;
    const treeComment = commentsById.get(comment.id);

    if (parentComment && treeComment) {
      parentComment.replies.push(treeComment);
    }
  }

  return rootComments
    .map((comment) => commentsById.get(comment.id))
    .filter((comment): comment is ArticleCommentTreeRecord => Boolean(comment));
}

export { PrismaArticleCommentRepository };
