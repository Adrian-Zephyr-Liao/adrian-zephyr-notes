import type { PaginatedResponse } from "./pagination.js";

type ArticleCategorySummary = {
  slug: string;
  name: string;
};

type ArticleCategoryDetailResponse = ArticleCategorySummary & {
  description: string | null;
  publishedArticleCount: number;
};

type ArticleCategoryListResponse = {
  data: ArticleCategoryDetailResponse[];
};

type ArticleTagSummary = {
  slug: string;
  name: string;
};

type ArticleTagDetailResponse = ArticleTagSummary & {
  publishedArticleCount: number;
};

type ArticleTagListQuery = { page?: number; pageSize?: number };
type ArticleTagListResponse = PaginatedResponse<ArticleTagDetailResponse>;

type ArticleOrigin = "ORIGINAL" | "REPOSTED";

type ArticleSource = {
  author: string | null;
  name: string;
  url: string;
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
  origin: ArticleOrigin;
  source: ArticleSource | null;
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
  ArticleCategoryDetailResponse,
  ArticleCategoryListResponse,
  ArticleAiSummaryResponse,
  ArticleDetailResponse,
  ArticleListItemResponse,
  ArticleListQuery,
  ArticleListResponse,
  ArticleOrigin,
  ArticleSource,
  ArticleTagSummary,
  ArticleTagDetailResponse,
  ArticleTagListQuery,
  ArticleTagListResponse,
};
