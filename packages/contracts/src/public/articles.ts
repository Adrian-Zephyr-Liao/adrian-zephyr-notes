import type { PaginatedResponse } from "./pagination.js";

type ArticleCategorySummary = {
  slug: string;
  name: string;
};

type ArticleTagSummary = {
  slug: string;
  name: string;
};

type ArticleListQuery = {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  q?: string;
};

type ArticleListItemResponse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ArticleCategorySummary | null;
  tags: ArticleTagSummary[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  publishedAt: string;
  updatedAt: string;
};

type ArticleDetailResponse = ArticleListItemResponse & {
  markdown: string;
};

type ArticleListResponse = PaginatedResponse<ArticleListItemResponse>;

export type {
  ArticleCategorySummary,
  ArticleDetailResponse,
  ArticleListItemResponse,
  ArticleListQuery,
  ArticleListResponse,
  ArticleTagSummary,
};
