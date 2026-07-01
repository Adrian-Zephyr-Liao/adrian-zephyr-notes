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

type ArticleRepository = {
  findPublishedBySlug(slug: string, now: Date): Promise<Article | null>;
  listPublished(filters: ListPublishedArticlesFilters): Promise<PaginatedResult<Article>>;
};

const ARTICLE_REPOSITORY = Symbol("ARTICLE_REPOSITORY");

export { ARTICLE_REPOSITORY };
export type { ArticleRepository, ListPublishedArticlesFilters, PaginatedResult };
