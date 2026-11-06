import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { recordPrismaAdminOperation } from "../../audit/infrastructure/prisma-admin-operation-log.repository";
import { createAdminOperationSummary } from "../../audit/domain/admin-operation-summary";
import {
  AdminArticleCommentConflictError,
  AdminArticleCommentNotFoundError,
} from "../application/admin-article-comment.errors";
import type {
  AdminArticleCommentListItem,
  AdminArticleCommentRepository,
  ListAdminArticleCommentsFilters,
  ListAdminArticleCommentsExecution,
  UpdateAdminArticleCommentStatusInput,
} from "../domain/admin-article-comment.repository";

const adminArticleCommentInclude = {
  _count: {
    select: {
      replies: true,
    },
  },
  article: {
    select: {
      id: true,
      slug: true,
      title: true,
    },
  },
  author: true,
  parentComment: {
    include: {
      author: true,
    },
  },
} satisfies Prisma.ArticleCommentInclude;

type AdminArticleCommentRecord = Prisma.ArticleCommentGetPayload<{
  include: typeof adminArticleCommentInclude;
}>;

@Injectable()
class PrismaAdminArticleCommentRepository implements AdminArticleCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filters: ListAdminArticleCommentsFilters,
    execution?: ListAdminArticleCommentsExecution,
  ) {
    const where = buildAdminArticleCommentWhere(filters);
    const query = {
      where,
      include: adminArticleCommentInclude,
      orderBy: [{ createdAt: filters.sort === "OLDEST" ? "asc" : "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    } satisfies Prisma.ArticleCommentFindManyArgs;
    if (
      execution &&
      (!Number.isSafeInteger(execution.statementTimeoutMs) ||
        execution.statementTimeoutMs < 1 ||
        execution.statementTimeoutMs > 5000)
    ) {
      throw new RangeError("Read statement timeout must be between 1 and 5000 milliseconds");
    }
    const [records, totalItems] = execution
      ? await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(execution.statementTimeoutMs)}, true)`;
            return [
              await tx.articleComment.findMany(query),
              await tx.articleComment.count({ where }),
            ] as const;
          },
          { timeout: execution.statementTimeoutMs * 2 + 1000 },
        )
      : await this.prisma.$transaction([
          this.prisma.articleComment.findMany(query),
          this.prisma.articleComment.count({ where }),
        ]);

    return {
      data: records.map(toAdminArticleCommentListItem),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async updateStatus(input: UpdateAdminArticleCommentStatusInput) {
    return this.prisma.$transaction(
      async (tx) => (await updateCommentStatusWithAudit(tx, input)).comment,
    );
  }
}

function buildAdminArticleCommentWhere(
  filters: ListAdminArticleCommentsFilters,
): Prisma.ArticleCommentWhereInput {
  const where: Prisma.ArticleCommentWhereInput = {};

  if (filters.articleId) {
    where.articleId = filters.articleId;
  }

  if (filters.articleSlug || filters.articleTitle) {
    where.article = {
      ...(filters.articleSlug
        ? { slug: { contains: filters.articleSlug, mode: "insensitive" } }
        : {}),
      ...(filters.articleTitle
        ? { title: { contains: filters.articleTitle, mode: "insensitive" } }
        : {}),
    };
  }

  if (filters.author) {
    where.author = {
      OR: [
        { login: { contains: filters.author, mode: "insensitive" } },
        { name: { contains: filters.author, mode: "insensitive" } },
      ],
    };
  }

  if (filters.body) {
    where.body = { contains: filters.body, mode: "insensitive" };
  }

  if (filters.commentId) {
    where.id = filters.commentId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
      ...(filters.createdTo ? { lt: filters.createdTo } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { body: { contains: filters.search, mode: "insensitive" } },
      { author: { login: { contains: filters.search, mode: "insensitive" } } },
      { author: { name: { contains: filters.search, mode: "insensitive" } } },
      { article: { title: { contains: filters.search, mode: "insensitive" } } },
      { article: { slug: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function toAdminArticleCommentListItem(
  record: AdminArticleCommentRecord,
): AdminArticleCommentListItem {
  return {
    id: record.id,
    body: record.body,
    status: record.status,
    parentCommentId: record.parentCommentId,
    article: record.article,
    author: toAdminArticleCommentAuthor(record.author),
    parent: record.parentComment
      ? {
          id: record.parentComment.id,
          body: record.parentComment.body,
          author: toAdminArticleCommentAuthor(record.parentComment.author),
        }
      : null,
    replyCount: record._count.replies,
    likeCount: record.likeCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toAdminArticleCommentAuthor(record: AdminArticleCommentRecord["author"]) {
  return {
    id: record.id,
    login: record.login,
    name: record.name,
    avatarUrl: record.avatarUrl,
    profileUrl: record.profileUrl,
  };
}

async function updateCommentStatusWithAudit(
  tx: Prisma.TransactionClient,
  input: UpdateAdminArticleCommentStatusInput,
) {
  const current = await tx.articleComment.findUnique({ where: { id: input.id } });
  if (!current) throw new AdminArticleCommentNotFoundError();
  if (input.expectedVersion !== undefined && current.moderationVersion !== input.expectedVersion)
    throw new AdminArticleCommentConflictError();
  const changed = await tx.articleComment.updateMany({
    where: { id: input.id, moderationVersion: input.expectedVersion ?? current.moderationVersion },
    data: { status: input.status, moderationVersion: { increment: 1 } },
  });
  if (!changed.count) throw new AdminArticleCommentConflictError();
  const record = await tx.articleComment.findUniqueOrThrow({
    where: { id: input.id },
    include: adminArticleCommentInclude,
  });
  const metadata = {
    articleSlug: record.article.slug,
    status: record.status,
    ...(input.assistantActionId
      ? { assistantActionId: input.assistantActionId, source: "assistant" }
      : {}),
  };
  const audit = await recordPrismaAdminOperation(tx.adminOperationLog, {
    actor: input.actor,
    action: "COMMENT_STATUS_UPDATED",
    resourceType: "article_comment",
    resourceId: record.id,
    requestContext: input.requestContext,
    metadata,
    summary: createAdminOperationSummary({
      action: "COMMENT_STATUS_UPDATED",
      resourceType: "article_comment",
      resourceId: record.id,
      metadata,
    }),
  });
  return {
    comment: toAdminArticleCommentListItem(record),
    previousStatus: current.status,
    auditLogId: audit.id,
  };
}

export {
  PrismaAdminArticleCommentRepository,
  buildAdminArticleCommentWhere,
  updateCommentStatusWithAudit,
};
