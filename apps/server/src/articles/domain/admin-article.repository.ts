import type { ArticleStatus } from "./article-status";

type ListAdminArticlesFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ArticleStatus;
};

type AdminArticleCategory = {
  slug: string;
  name: string;
};

type AdminArticleTag = {
  slug: string;
  name: string;
};

type AdminArticleAiSummaryStatus = "FAILED" | "GENERATING" | "PENDING" | "READY" | "UNQUEUED";

type AdminArticleListItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ArticleStatus;
  category: AdminArticleCategory | null;
  tags: AdminArticleTag[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  commentCount: number;
  aiSummaryStatus: AdminArticleAiSummaryStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdminArticleDetail = AdminArticleListItem & {
  markdown: string;
};

type AdminArticleTaxonomyOptions = {
  categories: AdminArticleCategory[];
  tags: AdminArticleTag[];
};

type AdminArticlesPage = {
  data: AdminArticleListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type UpdateAdminArticleRepositoryInput = {
  id: string;
  title?: string;
  description?: string;
  markdown?: string;
  status?: ArticleStatus;
  publishedAt?: Date | null;
  categorySlug?: string | null;
  tagSlugs?: string[];
  coverImageUrl?: string | null;
  wordCount?: number;
  readingMinutes?: number;
};

type CreateAdminArticleRepositoryInput = {
  slug: string;
  title: string;
  description: string;
  markdown: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  categorySlug: string | null;
  tagSlugs: string[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
};

interface AdminArticleRepository {
  create(input: CreateAdminArticleRepositoryInput): Promise<AdminArticleDetail>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<AdminArticleDetail | null>;
  list(filters: ListAdminArticlesFilters): Promise<AdminArticlesPage>;
  listTaxonomyOptions(): Promise<AdminArticleTaxonomyOptions>;
  update(input: UpdateAdminArticleRepositoryInput): Promise<AdminArticleDetail | null>;
}

const ADMIN_ARTICLE_REPOSITORY = Symbol("ADMIN_ARTICLE_REPOSITORY");

export { ADMIN_ARTICLE_REPOSITORY };
export type {
  AdminArticleAiSummaryStatus,
  AdminArticleCategory,
  AdminArticleDetail,
  AdminArticleListItem,
  AdminArticleRepository,
  AdminArticlesPage,
  AdminArticleTag,
  AdminArticleTaxonomyOptions,
  CreateAdminArticleRepositoryInput,
  ListAdminArticlesFilters,
  UpdateAdminArticleRepositoryInput,
};
