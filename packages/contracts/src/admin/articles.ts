import type {
  ArticleCategorySummary,
  ArticleOrigin,
  ArticleSource,
  ArticleTagSummary,
} from "../public/articles.js";
import type { PaginatedResponse } from "../public/pagination.js";

type AdminArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED";
type AdminArticleAiSummaryStatus = "FAILED" | "GENERATING" | "PENDING" | "READY" | "UNQUEUED";

type AdminArticleListQuery = {
  origin?: ArticleOrigin | "ALL";
  page?: number;
  pageSize?: number;
  q?: string;
  status?: AdminArticleStatus | "ALL";
};

type AdminArticleListItemResponse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  origin: ArticleOrigin;
  source: ArticleSource | null;
  status: AdminArticleStatus;
  category: ArticleCategorySummary | null;
  tags: ArticleTagSummary[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  commentCount: number;
  aiSummaryStatus: AdminArticleAiSummaryStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminArticleDetailResponse = AdminArticleListItemResponse & {
  markdown: string;
};

type AdminArticleTaxonomyOption = {
  slug: string;
  name: string;
};

type AdminArticleTaxonomyOptionsResponse = {
  categories: AdminArticleTaxonomyOption[];
  tags: AdminArticleTaxonomyOption[];
};

type AdminArticleCategoryListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type AdminArticleCategoryResponse = {
  articleCount: number;
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};

type AdminArticleCategoryListResponse = PaginatedResponse<AdminArticleCategoryResponse>;

type CreateAdminArticleCategoryRequest = {
  description?: string | null;
  name: string;
  slug: string;
};

type UpdateAdminArticleCategoryRequest = {
  description?: string | null;
  name?: string;
  slug?: string;
};

type AdminArticleTagListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type AdminArticleTagResponse = {
  articleCount: number;
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};

type AdminArticleTagListResponse = PaginatedResponse<AdminArticleTagResponse>;
type CreateAdminArticleTagRequest = { name: string; slug: string };
type UpdateAdminArticleTagRequest = { name?: string; slug?: string };
type MergeAdminArticleTagRequest = { targetTagId: string };

type AdminArticleEditorDraftValues = {
  title: string;
  description: string;
  markdown: string;
  status: AdminArticleStatus;
  categorySlug: string;
  tagSlugs: string[];
  coverImageUrl: string;
  origin: ArticleOrigin;
  sourceAuthor: string;
  sourceName: string;
  sourceUrl: string;
};

type AdminArticleEditorDraftResponse = {
  id: string;
  articleId: string | null;
  baseArticleUpdatedAt: string | null;
  savedAt: string;
  values: AdminArticleEditorDraftValues;
};

type SaveAdminArticleEditorDraftRequest = {
  articleId?: string | null;
  baseArticleUpdatedAt?: string | null;
  clientSavedAt: string;
  values: AdminArticleEditorDraftValues;
};

type UpdateAdminArticleRequest = {
  title?: string;
  description?: string;
  markdown?: string;
  status?: AdminArticleStatus;
  categorySlug?: string | null;
  tagSlugs?: string[];
  coverImageUrl?: string | null;
  origin?: ArticleOrigin;
  sourceAuthor?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

type CreateAdminArticleRequest = {
  title: string;
  description: string;
  markdown: string;
  status?: AdminArticleStatus;
  categorySlug?: string | null;
  tagSlugs?: string[];
  coverImageUrl?: string | null;
  origin?: ArticleOrigin;
  sourceAuthor?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

type AdminArticleListResponse = PaginatedResponse<AdminArticleListItemResponse>;

export type {
  AdminArticleAiSummaryStatus,
  AdminArticleCategoryListQuery,
  AdminArticleCategoryListResponse,
  AdminArticleCategoryResponse,
  AdminArticleDetailResponse,
  AdminArticleEditorDraftResponse,
  AdminArticleEditorDraftValues,
  AdminArticleListItemResponse,
  AdminArticleListQuery,
  AdminArticleListResponse,
  AdminArticleStatus,
  AdminArticleTaxonomyOption,
  AdminArticleTaxonomyOptionsResponse,
  AdminArticleTagListQuery,
  AdminArticleTagListResponse,
  AdminArticleTagResponse,
  CreateAdminArticleRequest,
  CreateAdminArticleCategoryRequest,
  CreateAdminArticleTagRequest,
  MergeAdminArticleTagRequest,
  SaveAdminArticleEditorDraftRequest,
  UpdateAdminArticleRequest,
  UpdateAdminArticleCategoryRequest,
  UpdateAdminArticleTagRequest,
};
