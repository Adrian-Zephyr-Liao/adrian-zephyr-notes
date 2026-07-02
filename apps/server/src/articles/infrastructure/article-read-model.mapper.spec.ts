import { describe, expect, it } from "vitest";
import { ARTICLE_SUMMARY_PROMPT_VERSION } from "../application/article-summary-content-hash";
import { ArticleAiSummary } from "../domain/article-ai-summary.entity";
import { Article } from "../domain/article.entity";
import { toArticleDetailResponse } from "./article-read-model.mapper";
import { createArticleSummaryContentHash } from "../application/article-summary-content-hash";

describe("article read model mapper", () => {
  it("returns a ready AI summary when the content hash matches", () => {
    const article = createArticle({
      aiSummary: createSummary({
        status: "READY",
        summary: "这是一段 AI 摘要。",
        contentHash: createArticleSummaryContentHash({
          title: "Markdown 语法全量展示",
          description: "文章摘要",
          markdown: "# Markdown",
        }),
        generatedAt: new Date("2026-07-02T10:01:00.000Z"),
      }),
    });

    expect(toArticleDetailResponse(article).aiSummary).toEqual({
      text: "这是一段 AI 摘要。",
      generatedAt: "2026-07-02T10:01:00.000Z",
    });
  });

  it("hides summaries that are not ready or no longer match article content", () => {
    const article = createArticle({
      aiSummary: createSummary({
        status: "READY",
        summary: "过期摘要",
        contentHash: "stale-hash",
        generatedAt: new Date("2026-07-02T10:01:00.000Z"),
      }),
    });

    expect(toArticleDetailResponse(article).aiSummary).toBeNull();
  });
});

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

function createSummary(overrides: Partial<Parameters<typeof ArticleAiSummary.create>[0]> = {}) {
  return ArticleAiSummary.create({
    id: "summary-1",
    articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    summary: null,
    status: "PENDING",
    contentHash: "hash",
    promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
    provider: null,
    model: null,
    attemptCount: 0,
    errorMessage: null,
    generatedAt: null,
    createdAt: new Date("2026-07-02T10:00:00.000Z"),
    updatedAt: new Date("2026-07-02T10:00:00.000Z"),
    ...overrides,
  });
}
