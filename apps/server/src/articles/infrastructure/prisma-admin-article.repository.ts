import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminArticleAiSummaryStatus,
  AdminArticleDetail,
  AdminArticleListItem,
  AdminArticleRepository,
  CreateAdminArticleRepositoryInput,
  ListAdminArticlesFilters,
  UpdateAdminArticleRepositoryInput,
} from "../domain/admin-article.repository";

const adminArticleInclude = {
  _count: {
    select: {
      comments: true,
    },
  },
  aiSummary: true,
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ArticleInclude;

type AdminArticleRecord = Prisma.ArticleGetPayload<{
  include: typeof adminArticleInclude;
}>;

@Injectable()
class PrismaAdminArticleRepository implements AdminArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAdminArticleRepositoryInput) {
    return await this.prisma.$transaction(async (tx) => {
      const record = await tx.article.create({
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          markdown: input.markdown,
          status: input.status,
          publishedAt: input.publishedAt,
          coverImageUrl: input.coverImageUrl,
          wordCount: input.wordCount,
          readingMinutes: input.readingMinutes,
          category: input.categorySlug
            ? {
                connect: {
                  slug: input.categorySlug,
                },
              }
            : undefined,
        },
        include: adminArticleInclude,
      });

      if (input.tagSlugs.length > 0) {
        const tags = await tx.articleTag.findMany({
          where: {
            slug: {
              in: input.tagSlugs,
            },
          },
          select: {
            id: true,
          },
        });

        await tx.articleTagLink.createMany({
          data: tags.map((tag) => ({
            articleId: record.id,
            tagId: tag.id,
          })),
          skipDuplicates: true,
        });
      }

      const created = await tx.article.findUnique({
        where: { id: record.id },
        include: adminArticleInclude,
      });

      if (!created) {
        throw new Error("Created article could not be loaded.");
      }

      return toAdminArticleDetail(created);
    });
  }

  async delete(id: string) {
    try {
      await this.prisma.article.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return false;
      }

      throw error;
    }
  }

  async findById(id: string) {
    const record = await this.prisma.article.findUnique({
      where: { id },
      include: adminArticleInclude,
    });

    return record ? toAdminArticleDetail(record) : null;
  }

  async list(filters: ListAdminArticlesFilters) {
    const where = buildAdminArticleWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: adminArticleInclude,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: records.map(toAdminArticleListItemResponse),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async listTaxonomyOptions() {
    const [categories, tags] = await this.prisma.$transaction([
      this.prisma.articleCategory.findMany({
        orderBy: [{ name: "asc" }, { slug: "asc" }],
        select: {
          name: true,
          slug: true,
        },
      }),
      this.prisma.articleTag.findMany({
        orderBy: [{ name: "asc" }, { slug: "asc" }],
        select: {
          name: true,
          slug: true,
        },
      }),
    ]);

    return {
      categories,
      tags,
    };
  }

  async update(input: UpdateAdminArticleRepositoryInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = buildArticleUpdateData(input);

        if (Object.keys(data).length > 0) {
          await tx.article.update({
            where: { id: input.id },
            data,
          });
        }

        if (input.tagSlugs !== undefined) {
          const tags = await tx.articleTag.findMany({
            where: {
              slug: {
                in: input.tagSlugs,
              },
            },
            select: {
              id: true,
            },
          });

          await tx.articleTagLink.deleteMany({
            where: {
              articleId: input.id,
            },
          });

          await tx.articleTagLink.createMany({
            data: tags.map((tag) => ({
              articleId: input.id,
              tagId: tag.id,
            })),
            skipDuplicates: true,
          });
        }

        const record = await tx.article.findUnique({
          where: { id: input.id },
          include: adminArticleInclude,
        });

        return record ? toAdminArticleDetail(record) : null;
      });
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function buildAdminArticleWhere(filters: ListAdminArticlesFilters): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { slug: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildArticleUpdateData(
  input: UpdateAdminArticleRepositoryInput,
): Prisma.ArticleUpdateInput {
  const data: Prisma.ArticleUpdateInput = {};

  if (input.title !== undefined) {
    data.title = input.title;
  }

  if (input.description !== undefined) {
    data.description = input.description;
  }

  if (input.markdown !== undefined) {
    data.markdown = input.markdown;
  }

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.publishedAt !== undefined) {
    data.publishedAt = input.publishedAt;
  }

  if (input.coverImageUrl !== undefined) {
    data.coverImageUrl = input.coverImageUrl;
  }

  if (input.wordCount !== undefined) {
    data.wordCount = input.wordCount;
  }

  if (input.readingMinutes !== undefined) {
    data.readingMinutes = input.readingMinutes;
  }

  if (input.categorySlug !== undefined) {
    data.category = input.categorySlug
      ? {
          connect: {
            slug: input.categorySlug,
          },
        }
      : {
          disconnect: true,
        };
  }

  return data;
}

function toAdminArticleListItemResponse(record: AdminArticleRecord): AdminArticleListItem {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    status: record.status,
    category: record.category
      ? {
          slug: record.category.slug,
          name: record.category.name,
        }
      : null,
    tags: record.tags.map((link) => ({
      slug: link.tag.slug,
      name: link.tag.name,
    })),
    coverImageUrl: record.coverImageUrl,
    wordCount: record.wordCount,
    readingMinutes: record.readingMinutes,
    commentCount: record._count.comments,
    aiSummaryStatus: toAdminArticleAiSummaryStatus(record.aiSummary?.status),
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toAdminArticleDetail(record: AdminArticleRecord): AdminArticleDetail {
  return {
    ...toAdminArticleListItemResponse(record),
    markdown: record.markdown,
  };
}

function toAdminArticleAiSummaryStatus(
  status: NonNullable<AdminArticleRecord["aiSummary"]>["status"] | undefined,
): AdminArticleAiSummaryStatus {
  return status ?? "UNQUEUED";
}

function isPrismaRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export { PrismaAdminArticleRepository };
