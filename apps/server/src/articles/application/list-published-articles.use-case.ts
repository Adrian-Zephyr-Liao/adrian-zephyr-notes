import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_REPOSITORY,
  type ArticleRepository,
  type ListPublishedArticlesFilters,
} from "../domain/article.repository";

type ListPublishedArticlesInput = {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  now?: Date;
};

@Injectable()
class ListPublishedArticlesUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
  ) {}

  execute(input: ListPublishedArticlesInput = {}) {
    return this.articleRepository.listPublished(normalizeListInput(input));
  }
}

function normalizeListInput(input: ListPublishedArticlesInput): ListPublishedArticlesFilters {
  const page = normalizePositiveInteger(input.page, 1);
  const requestedPageSize = normalizePositiveInteger(input.pageSize, 10);

  return {
    page,
    pageSize: Math.min(requestedPageSize, 50),
    categorySlug: normalizeOptionalText(input.categorySlug),
    tagSlug: normalizeOptionalText(input.tagSlug),
    search: normalizeOptionalText(input.search),
    now: input.now ?? new Date(),
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return fallback;
  }

  return value;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export { ListPublishedArticlesUseCase, normalizeListInput };
export type { ListPublishedArticlesInput };
