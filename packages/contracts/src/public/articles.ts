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

type ArticleAiSummaryResponse = {
  text: string;
  generatedAt: string;
};

type ArticleDetailResponse = ArticleListItemResponse & {
  aiSummary: ArticleAiSummaryResponse | null;
  markdown: string;
};

type ArticleListResponse = PaginatedResponse<ArticleListItemResponse>;

export type {
  ArticleCategorySummary,
  ArticleAiSummaryResponse,
  ArticleDetailResponse,
  ArticleListItemResponse,
  ArticleListQuery,
  ArticleListResponse,
  ArticleTagSummary,
};
