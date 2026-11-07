import type { Article } from "./article.entity";

type PaginatedResult<TItem> = {
  data: TItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ListPublishedArticlesFilters = {
  page: number;
  pageSize: number;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  now: Date;
};

type PublishedArticleCategory = {
  description: string | null;
  name: string;
  publishedArticleCount: number;
  slug: string;
};

type PublishedArticleTag = {
  name: string;
  publishedArticleCount: number;
  slug: string;
};

type ListPublishedTagsFilters = { now: Date; page: number; pageSize: number };

type ArticlePreview = Pick<
  Article,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "origin"
  | "source"
  | "category"
  | "tags"
  | "coverImageUrl"
  | "wordCount"
  | "readingMinutes"
  | "publishedAt"
  | "updatedAt"
>;

type ArticleRepository = {
  findPublishedCategoryBySlug(slug: string, now: Date): Promise<PublishedArticleCategory | null>;
  findPublishedBySlug(slug: string, now: Date): Promise<Article | null>;
  findPublishedTagBySlug(slug: string, now: Date): Promise<PublishedArticleTag | null>;
  listPublishedCategories(now: Date): Promise<PublishedArticleCategory[]>;
  listPublishedTags(
    filters: ListPublishedTagsFilters,
  ): Promise<PaginatedResult<PublishedArticleTag>>;
  listPublished(filters: ListPublishedArticlesFilters): Promise<PaginatedResult<ArticlePreview>>;
};

const ARTICLE_REPOSITORY = Symbol("ARTICLE_REPOSITORY");

export { ARTICLE_REPOSITORY };
export type {
  ArticlePreview,
  ArticleRepository,
  ListPublishedArticlesFilters,
  ListPublishedTagsFilters,
  PaginatedResult,
  PublishedArticleCategory,
  PublishedArticleTag,
};
