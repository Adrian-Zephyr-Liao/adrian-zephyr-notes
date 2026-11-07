import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import {
  ARTICLE_SUMMARY_PROMPT_VERSION,
  createArticleSummaryContentHash,
} from "../application/article-summary-content-hash";
import { toArticleDetailResponse, toArticleListResponse } from "./article-read-model.mapper";
import { PrismaArticleRepository } from "./prisma-article.repository";

describe("PrismaArticleRepository public reads", () => {
  const now = new Date("2026-11-07T00:00:00Z");

  it("returns the same public previews without selecting full article content or AI summaries", async () => {
    const record = previewRecord();
    const prisma = createPrismaDouble([record], 23);
    const result = await new PrismaArticleRepository(prisma.client).listPublished({
      page: 2,
      pageSize: 10,
      categorySlug: "engineering",
      tagSlug: "postgresql",
      search: "transaction",
      now,
    });

    const query = prisma.findMany.mock.calls[0]![0];
    expect(query).not.toHaveProperty("include");
    expect(query.select).toBeDefined();
    expect(query.select).not.toHaveProperty("markdown");
    expect(query.select).not.toHaveProperty("aiSummary");
    expect(query).toMatchObject({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
        category: { slug: "engineering" },
        tags: { some: { tag: { slug: "postgresql" } } },
        OR: [
          { title: { contains: "transaction", mode: "insensitive" } },
          { description: { contains: "transaction", mode: "insensitive" } },
          { markdown: { contains: "transaction", mode: "insensitive" } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: 10,
      take: 10,
    });
    expect(prisma.count).toHaveBeenCalledWith({ where: query.where });
    expect(toArticleListResponse(result)).toEqual({
      data: [
        {
          id: record.id,
          slug: "transaction-notes",
          title: "Transaction notes",
          description: "Notes about PostgreSQL transactions.",
          origin: "REPOSTED",
          source: { author: "Ada", name: "Engineering", url: "https://example.test/original" },
          category: { name: "Engineering", slug: "engineering" },
          tags: [{ name: "PostgreSQL", slug: "postgresql" }],
          coverImageUrl: "https://img.zephyrai.site/cover.webp",
          wordCount: 2400,
          readingMinutes: 8,
          publishedAt: "2026-11-06T10:00:00.000Z",
          updatedAt: "2026-11-06T11:00:00.000Z",
        },
      ],
      pagination: { page: 2, pageSize: 10, totalItems: 23, totalPages: 3 },
    });
  });

  it("preserves optional preview fields for an original, uncategorized article", async () => {
    const record = {
      ...previewRecord(),
      origin: "ORIGINAL" as const,
      sourceName: null,
      sourceAuthor: null,
      sourceUrl: null,
      category: null,
      tags: [],
      coverImageUrl: null,
      wordCount: 0,
      readingMinutes: 0,
    };
    const prisma = createPrismaDouble([record], 1);
    const result = await new PrismaArticleRepository(prisma.client).listPublished({
      page: 1,
      pageSize: 10,
      now,
    });

    expect(toArticleListResponse(result).data[0]).toMatchObject({
      origin: "ORIGINAL",
      source: null,
      category: null,
      tags: [],
      coverImageUrl: null,
      wordCount: 0,
      readingMinutes: 0,
    });
  });

  it("still loads full content and a matching ready summary for article detail", async () => {
    const record = previewRecord();
    const markdown = "# Transactions\n\nDetailed article content.";
    const prisma = createPrismaDouble([], 0);
    prisma.findFirst.mockResolvedValue({
      ...record,
      status: "PUBLISHED",
      markdown,
      createdAt: record.publishedAt,
      aiSummary: {
        id: "summary-1",
        articleId: record.id,
        summary: "A ready article summary.",
        status: "READY",
        contentHash: createArticleSummaryContentHash({
          title: record.title.trim(),
          description: record.description.trim(),
          markdown,
        }),
        promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
        provider: "provider",
        model: "model",
        attemptCount: 1,
        errorMessage: null,
        generatedAt: record.updatedAt,
        createdAt: record.publishedAt,
        updatedAt: record.updatedAt,
      },
    });

    const article = await new PrismaArticleRepository(prisma.client).findPublishedBySlug(
      record.slug,
      now,
    );

    expect(prisma.findFirst).toHaveBeenCalledWith({
      where: { slug: record.slug, status: "PUBLISHED", publishedAt: { lte: now } },
      include: { category: true, tags: { include: { tag: true } }, aiSummary: true },
    });
    expect(article).not.toBeNull();
    expect(toArticleDetailResponse(article!)).toMatchObject({
      markdown,
      aiSummary: { text: "A ready article summary.", generatedAt: "2026-11-06T11:00:00.000Z" },
    });
  });
});

function createPrismaDouble(records: unknown[], totalItems: number) {
  const findMany = vi.fn((_query: Prisma.ArticleFindManyArgs) => Promise.resolve(records));
  const findFirst = vi.fn();
  const count = vi.fn().mockResolvedValue(totalItems);
  const client = {
    article: { findMany, findFirst, count },
    $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
  } as unknown as PrismaService;
  return { client, findMany, findFirst, count };
}

function previewRecord() {
  return {
    id: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    slug: "transaction-notes",
    title: " Transaction notes ",
    description: " Notes about PostgreSQL transactions. ",
    origin: "REPOSTED" as const,
    sourceName: " Engineering ",
    sourceAuthor: " Ada ",
    sourceUrl: " https://example.test/original ",
    category: { name: "Engineering", slug: "engineering" },
    tags: [{ tag: { name: "PostgreSQL", slug: "postgresql" } }],
    coverImageUrl: "https://img.zephyrai.site/cover.webp",
    wordCount: 2400,
    readingMinutes: 8,
    publishedAt: new Date("2026-11-06T10:00:00Z"),
    updatedAt: new Date("2026-11-06T11:00:00Z"),
  };
}
