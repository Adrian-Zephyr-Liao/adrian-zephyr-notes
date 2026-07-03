import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminArticleCommentListItem,
  AdminArticleCommentRepository,
  ListAdminArticleCommentsFilters,
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

  async list(filters: ListAdminArticleCommentsFilters) {
    const where = buildAdminArticleCommentWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.articleComment.findMany({
        where,
        include: adminArticleCommentInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
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
    try {
      const record = await this.prisma.articleComment.update({
        where: { id: input.id },
        data: {
          status: input.status,
        },
        include: adminArticleCommentInclude,
      });

      return toAdminArticleCommentListItem(record);
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function buildAdminArticleCommentWhere(
  filters: ListAdminArticleCommentsFilters,
): Prisma.ArticleCommentWhereInput {
  const where: Prisma.ArticleCommentWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
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

function isPrismaRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export { PrismaAdminArticleCommentRepository };
