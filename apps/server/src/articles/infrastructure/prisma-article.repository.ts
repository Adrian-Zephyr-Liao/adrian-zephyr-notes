import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ArticleAiSummary } from "../domain/article-ai-summary.entity";
import { Article } from "../domain/article.entity";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";

const articleInclude = {
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
  aiSummary: true,
} satisfies Prisma.ArticleInclude;

type ArticleRecord = Prisma.ArticleGetPayload<{
  include: typeof articleInclude;
}>;

@Injectable()
class PrismaArticleRepository implements ArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublishedCategoryBySlug(slug: string, now: Date) {
    const category = await this.prisma.articleCategory.findUnique({
      where: { slug },
      select: {
        id: true,
        description: true,
        name: true,
        slug: true,
      },
    });

    if (!category) {
      return null;
    }

    const publishedArticleCount = await this.prisma.article.count({
      where: {
        categoryId: category.id,
        publishedAt: { lte: now },
        status: "PUBLISHED",
      },
    });

    return {
      description: category.description,
      name: category.name,
      publishedArticleCount,
      slug: category.slug,
    };
  }

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

  async findPublishedTagBySlug(slug: string, now: Date) {
    const tag = await this.prisma.articleTag.findUnique({
      select: { id: true, name: true, slug: true },
      where: { slug },
    });

    if (!tag) return null;

    const publishedArticleCount = await this.prisma.article.count({
      where: {
        publishedAt: { lte: now },
        status: "PUBLISHED",
        tags: { some: { tagId: tag.id } },
      },
    });

    return { name: tag.name, publishedArticleCount, slug: tag.slug };
  }

  async listPublishedCategories(now: Date) {
    const publishedWhere = {
      publishedAt: { lte: now },
      status: "PUBLISHED" as const,
    };
    const categories = await this.prisma.articleCategory.findMany({
      orderBy: [{ name: "asc" }, { slug: "asc" }],
      select: {
        description: true,
        name: true,
        slug: true,
        _count: {
          select: {
            articles: { where: publishedWhere },
          },
        },
      },
      where: {
        articles: { some: publishedWhere },
      },
    });

    return categories.map((category) => ({
      description: category.description,
      name: category.name,
      publishedArticleCount: category._count.articles,
      slug: category.slug,
    }));
  }

  async listPublishedTags(filters: { now: Date; page: number; pageSize: number }) {
    const offset = (filters.page - 1) * filters.pageSize;
    const [records, totals] = await this.prisma.$transaction([
      this.prisma.$queryRaw<PublishedTagRow[]>`
        SELECT
          tag.name,
          tag.slug,
          COUNT(*)::integer AS "publishedArticleCount"
        FROM "article_tags" AS tag
        INNER JOIN "article_tag_links" AS link ON link."tag_id" = tag.id
        INNER JOIN "articles" AS article ON article.id = link."article_id"
        WHERE article.status = 'PUBLISHED'
          AND article."published_at" <= ${filters.now}
        GROUP BY tag.id, tag.name, tag.slug
        ORDER BY COUNT(*) DESC, tag.name ASC, tag.slug ASC
        LIMIT ${filters.pageSize}
        OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT tag.id
          FROM "article_tags" AS tag
          INNER JOIN "article_tag_links" AS link ON link."tag_id" = tag.id
          INNER JOIN "articles" AS article ON article.id = link."article_id"
          WHERE article.status = 'PUBLISHED'
            AND article."published_at" <= ${filters.now}
          GROUP BY tag.id
        ) AS published_tags
      `,
    ]);
    const totalItems = Number(totals[0]?.total ?? 0);

    return {
      data: records,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
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

type PublishedTagRow = {
  name: string;
  publishedArticleCount: number;
  slug: string;
};

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
    origin: record.origin,
    source:
      record.origin === "REPOSTED" && record.sourceName && record.sourceUrl
        ? {
            author: record.sourceAuthor,
            name: record.sourceName,
            url: record.sourceUrl,
          }
        : null,
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
    aiSummary: record.aiSummary ? toDomainArticleAiSummary(record.aiSummary) : null,
  });
}

function toDomainArticleAiSummary(record: ArticleRecord["aiSummary"]) {
  if (!record) {
    return null;
  }

  return ArticleAiSummary.create({
    id: record.id,
    articleId: record.articleId,
    summary: record.summary,
    status: record.status,
    contentHash: record.contentHash,
    promptVersion: record.promptVersion,
    provider: record.provider,
    model: record.model,
    attemptCount: record.attemptCount,
    errorMessage: record.errorMessage,
    generatedAt: record.generatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export { PrismaArticleRepository };
