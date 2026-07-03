import type { ArticleCategorySummary, ArticleTagSummary } from "../public/articles.js";
import type { PaginatedResponse } from "../public/pagination.js";

type AdminArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED";
type AdminArticleAiSummaryStatus = "FAILED" | "GENERATING" | "PENDING" | "READY" | "UNQUEUED";

type AdminArticleListQuery = {
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

type AdminArticleEditorDraftValues = {
  title: string;
  description: string;
  markdown: string;
  status: AdminArticleStatus;
  categorySlug: string;
  tagSlugs: string[];
  coverImageUrl: string;
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
};

type CreateAdminArticleRequest = {
  title: string;
  description: string;
  markdown: string;
  status?: AdminArticleStatus;
  categorySlug?: string | null;
  tagSlugs?: string[];
  coverImageUrl?: string | null;
};

type AdminArticleListResponse = PaginatedResponse<AdminArticleListItemResponse>;

export type {
  AdminArticleAiSummaryStatus,
  AdminArticleDetailResponse,
  AdminArticleEditorDraftResponse,
  AdminArticleEditorDraftValues,
  AdminArticleListItemResponse,
  AdminArticleListQuery,
  AdminArticleListResponse,
  AdminArticleStatus,
  AdminArticleTaxonomyOption,
  AdminArticleTaxonomyOptionsResponse,
  CreateAdminArticleRequest,
  SaveAdminArticleEditorDraftRequest,
  UpdateAdminArticleRequest,
};
