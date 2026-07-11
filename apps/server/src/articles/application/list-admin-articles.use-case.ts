import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
  type ListAdminArticlesFilters,
} from "../domain/admin-article.repository";

type ListAdminArticlesInput = {
  origin?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

@Injectable()
class ListAdminArticlesUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
  ) {}

  execute(input: ListAdminArticlesInput = {}) {
    return this.adminArticleRepository.list(normalizeListAdminArticlesInput(input));
  }
}

function normalizeListAdminArticlesInput(input: ListAdminArticlesInput): ListAdminArticlesFilters {
  return {
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
    origin: normalizeOrigin(input.origin),
    search: normalizeOptionalText(input.search),
    status: normalizeStatus(input.status),
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

function normalizeStatus(value: string | undefined) {
  return value === "ARCHIVED" || value === "DRAFT" || value === "PUBLISHED" ? value : undefined;
}

function normalizeOrigin(value: string | undefined) {
  return value === "ORIGINAL" || value === "REPOSTED" ? value : undefined;
}

export { ListAdminArticlesUseCase, normalizeListAdminArticlesInput };
export type { ListAdminArticlesInput };
