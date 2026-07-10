import { describe, expect, it } from "vitest";
import { ArticleAiSummary } from "../domain/article-ai-summary.entity";
import { Article } from "../domain/article.entity";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";
import {
  ARTICLE_SUMMARY_PROMPT_VERSION,
  createArticleSummaryContentHash,
} from "./article-summary-content-hash";
import { ArticleNotFoundError } from "./article-not-found.error";
import type {
  GeneratePendingArticleSummariesResult,
  GeneratePendingArticleSummariesUseCase,
} from "./generate-pending-article-summaries.use-case";
import { GetPublishedArticleBySlugUseCase } from "./get-published-article-by-slug.use-case";
import type { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

describe("GetPublishedArticleBySlugUseCase", () => {
  it("generates a missing AI summary and returns the refreshed article", async () => {
    const article = createArticle();
    const refreshedArticle = createArticle({
      aiSummary: createReadySummary(),
    });
    const queue = new StaticQueueArticleSummaryUseCase();
    const generator = new StaticGeneratePendingArticleSummariesUseCase({ succeeded: 1 });
    const repository = new StaticArticleRepository([article, refreshedArticle]);
    const useCase = new GetPublishedArticleBySlugUseCase(
      repository,
      queue as unknown as QueueArticleSummaryUseCase,
      generator as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7", new Date("2026-07-02T00:00:00.000Z"))).resolves.toBe(
      refreshedArticle,
    );
    expect(queue.queuedArticleIds).toEqual(["24c86b96-1962-4a2a-8632-2d1425c45a3f"]);
    expect(generator.inputs).toEqual([
      {
        articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
        limit: 1,
      },
    ]);
    expect(repository.findInputs).toEqual([
      {
        now: new Date("2026-07-02T00:00:00.000Z"),
        slug: "5f7448b7",
      },
      {
        now: new Date("2026-07-02T00:00:00.000Z"),
        slug: "5f7448b7",
      },
    ]);
  });

  it("returns the article when summary generation is skipped", async () => {
    const article = createArticle();
    const useCase = new GetPublishedArticleBySlugUseCase(
      new StaticArticleRepository([article]),
      new StaticQueueArticleSummaryUseCase() as unknown as QueueArticleSummaryUseCase,
      new StaticGeneratePendingArticleSummariesUseCase({
        skipped: true,
        succeeded: 0,
      }) as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7", new Date("2026-07-02T00:00:00.000Z"))).resolves.toBe(
      article,
    );
  });

  it("does not queue generation when the article already has a fresh summary", async () => {
    const article = createArticle({
      aiSummary: createReadySummary(),
    });
    const queue = new StaticQueueArticleSummaryUseCase();
    const generator = new StaticGeneratePendingArticleSummariesUseCase();
    const useCase = new GetPublishedArticleBySlugUseCase(
      new StaticArticleRepository([article]),
      queue as unknown as QueueArticleSummaryUseCase,
      generator as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7", new Date("2026-07-02T00:00:00.000Z"))).resolves.toBe(
      article,
    );
    expect(queue.queuedArticleIds).toEqual([]);
    expect(generator.inputs).toEqual([]);
  });

  it("throws a domain-level not found error for missing articles", async () => {
    const useCase = new GetPublishedArticleBySlugUseCase(
      new StaticArticleRepository([null]),
      new StaticQueueArticleSummaryUseCase() as unknown as QueueArticleSummaryUseCase,
      new StaticGeneratePendingArticleSummariesUseCase() as unknown as GeneratePendingArticleSummariesUseCase,
    );

    await expect(useCase.execute("5f7448b7")).rejects.toBeInstanceOf(ArticleNotFoundError);
  });
});

class StaticArticleRepository implements ArticleRepository {
  readonly findInputs: Array<{ slug: string; now: Date }> = [];

  constructor(private readonly articles: Array<Article | null>) {}

  async findPublishedBySlug(slug: string, now: Date) {
    this.findInputs.push({ slug, now });
    return this.articles.shift() ?? null;
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
  private readonly result: GeneratePendingArticleSummariesResult;

  constructor(result: Partial<GeneratePendingArticleSummariesResult> = {}) {
    this.result = {
      failed: 0,
      processed: 1,
      skipped: false,
      succeeded: 1,
      ...result,
    };
  }

  async execute(input: { articleId?: string; limit?: number } = {}) {
    this.inputs.push(input);

    return {
      failed: this.result.failed,
      processed: this.result.processed,
      skipped: this.result.skipped,
      succeeded: this.result.succeeded,
    };
  }
}

function createArticle(overrides: Partial<Parameters<typeof Article.create>[0]> = {}) {
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
    ...overrides,
  });
}

function createReadySummary() {
  return ArticleAiSummary.create({
    id: "summary-1",
    articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    summary: "这是一段 AI 摘要。",
    status: "READY",
    contentHash: createArticleSummaryContentHash({
      title: "Markdown 语法全量展示",
      description: "文章摘要",
      markdown: "# Markdown",
    }),
    promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
    provider: "minimax",
    model: "MiniMax-M3",
    attemptCount: 1,
    errorMessage: null,
    generatedAt: new Date("2026-07-02T10:01:00.000Z"),
    createdAt: new Date("2026-07-02T10:00:00.000Z"),
    updatedAt: new Date("2026-07-02T10:01:00.000Z"),
  });
}
