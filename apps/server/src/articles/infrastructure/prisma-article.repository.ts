import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { Article } from "../domain/article.entity";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";

const articleInclude = {
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ArticleInclude;

type ArticleRecord = Prisma.ArticleGetPayload<{
  include: typeof articleInclude;
}>;

@Injectable()
class PrismaArticleRepository implements ArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublishedBySlug(slug: string, now: Date) {
    const record = await this.prisma.article.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: {
          lte: now,
        },
      },
      include: articleInclude,
    });

    return record ? toDomainArticle(record) : null;
  }

  async listPublished(filters: ListPublishedArticlesFilters) {
    const where = buildPublishedWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: articleInclude,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: records.map(toDomainArticle),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }
}

function buildPublishedWhere(filters: ListPublishedArticlesFilters): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = {
    status: "PUBLISHED",
    publishedAt: {
      lte: filters.now,
    },
  };

  if (filters.categorySlug) {
    where.category = {
      slug: filters.categorySlug,
    };
  }

  if (filters.tagSlug) {
    where.tags = {
      some: {
        tag: {
          slug: filters.tagSlug,
        },
      },
    };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { markdown: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function toDomainArticle(record: ArticleRecord) {
  return Article.create({
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    markdown: record.markdown,
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
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export { PrismaArticleRepository };
