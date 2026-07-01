import type {
  ArticleDetailResponse,
  ArticleListItemResponse,
  ArticleListResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Article } from "../domain/article.entity";
import type { PaginatedResult } from "../domain/article.repository";

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
    markdown: article.markdown,
  };
}

function toArticleListResponse(result: PaginatedResult<Article>): ArticleListResponse {
  return {
    data: result.data.map(toArticleListItemResponse),
    pagination: result.pagination,
  };
}

export { toArticleDetailResponse, toArticleListItemResponse, toArticleListResponse };
