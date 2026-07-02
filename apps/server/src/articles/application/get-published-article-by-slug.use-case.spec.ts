import { describe, expect, it } from "vitest";
import { Article } from "../domain/article.entity";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";
import { ArticleNotFoundError } from "./article-not-found.error";
import type { GeneratePendingArticleSummariesUseCase } from "./generate-pending-article-summaries.use-case";
import { GetPublishedArticleBySlugUseCase } from "./get-published-article-by-slug.use-case";
import type { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

describe("GetPublishedArticleBySlugUseCase", () => {
  it("returns a published article by slug", async () => {
    const article = createArticle();
    const queue = new StaticQueueArticleSummaryUseCase();
    const generator = new StaticGeneratePendingArticleSummariesUseCase();
    const useCase = new GetPublishedArticleBySlugUseCase(
      new StaticArticleRepository(article),
      queue as unknown as QueueArticleSummaryUseCase,
      generator as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7", new Date("2026-07-02T00:00:00.000Z"))).resolves.toBe(
      article,
    );
    await waitForMicrotasks();
    expect(queue.queuedArticleIds).toEqual(["24c86b96-1962-4a2a-8632-2d1425c45a3f"]);
    expect(generator.inputs).toEqual([
      {
        articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
        limit: 1,
      },
    ]);
  });

  it("throws a domain-level not found error for missing articles", async () => {
    const useCase = new GetPublishedArticleBySlugUseCase(
      new StaticArticleRepository(null),
      new StaticQueueArticleSummaryUseCase() as unknown as QueueArticleSummaryUseCase,
      new StaticGeneratePendingArticleSummariesUseCase() as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7")).rejects.toBeInstanceOf(ArticleNotFoundError);
  });
});

class StaticArticleRepository implements ArticleRepository {
  constructor(private readonly article: Article | null) {}

  async findPublishedBySlug() {
    return this.article;
  }

  async listPublished(filters: ListPublishedArticlesFilters) {
    return {
      data: [],
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }
}

class StaticQueueArticleSummaryUseCase {
  queuedArticleIds: string[] = [];

  async execute(input: { articleId: string }) {
    this.queuedArticleIds.push(input.articleId);
    return "QUEUED" as const;
  }
}

class StaticGeneratePendingArticleSummariesUseCase {
  inputs: Array<{ articleId?: string; limit?: number }> = [];

  async execute(input: { articleId?: string; limit?: number } = {}) {
    this.inputs.push(input);

    return {
      failed: 0,
      processed: 0,
      skipped: true,
      succeeded: 0,
    };
  }
}

function createArticle() {
  return Article.create({
    id: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    slug: "5f7448b7",
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
    status: "PUBLISHED",
    category: { slug: "markdown", name: "Markdown" },
    tags: [{ slug: "gfm", name: "GFM" }],
    coverImageUrl: null,
    wordCount: 1200,
    readingMinutes: 4,
    publishedAt: new Date("2026-07-02T10:00:00.000Z"),
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-02T10:00:00.000Z"),
  });
}

async function waitForMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
