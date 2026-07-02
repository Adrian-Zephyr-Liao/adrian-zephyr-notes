import type {
  ArticleAiSummaryResponse,
  ArticleDetailResponse,
  ArticleListItemResponse,
  ArticleListResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Article } from "../domain/article.entity";
import type { PaginatedResult } from "../domain/article.repository";
import {
  ARTICLE_SUMMARY_PROMPT_VERSION,
  createArticleSummaryContentHash,
} from "../application/article-summary-content-hash";

function toArticleListItemResponse(article: Article): ArticleListItemResponse {
  const publishedAt = article.publishedAt;

  if (!publishedAt) {
    throw new Error("Published article response requires publishedAt.");
  }

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags,
    coverImageUrl: article.coverImageUrl,
    wordCount: article.wordCount,
    readingMinutes: article.readingMinutes,
    publishedAt: publishedAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

function toArticleDetailResponse(article: Article): ArticleDetailResponse {
  return {
    ...toArticleListItemResponse(article),
    aiSummary: toArticleAiSummaryResponse(article),
    markdown: article.markdown,
  };
}

function toArticleListResponse(result: PaginatedResult<Article>): ArticleListResponse {
  return {
    data: result.data.map(toArticleListItemResponse),
    pagination: result.pagination,
  };
}

function toArticleAiSummaryResponse(article: Article): ArticleAiSummaryResponse | null {
  const summary = article.aiSummary;

  if (!summary) {
    return null;
  }

  const contentHash = createArticleSummaryContentHash({
    title: article.title,
    description: article.description,
    markdown: article.markdown,
  });

  if (!summary.isReadyFor(contentHash, ARTICLE_SUMMARY_PROMPT_VERSION)) {
    return null;
  }

  const text = summary.summary;
  const generatedAt = summary.generatedAt;

  if (!text || !generatedAt) {
    return null;
  }

  return {
    text,
    generatedAt: generatedAt.toISOString(),
  };
}

export { toArticleDetailResponse, toArticleListItemResponse, toArticleListResponse };
