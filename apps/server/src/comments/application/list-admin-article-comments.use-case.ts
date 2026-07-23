import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_COMMENT_REPOSITORY,
  type AdminArticleCommentRepository,
  type AdminArticleCommentStatus,
  type ListAdminArticleCommentsFilters,
} from "../domain/admin-article-comment.repository";

type ListAdminArticleCommentsInput = {
  articleId?: string;
  articleSlug?: string;
  articleTitle?: string;
  author?: string;
  body?: string;
  commentId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  status?: string;
};

@Injectable()
class ListAdminArticleCommentsUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_COMMENT_REPOSITORY)
    private readonly adminArticleCommentRepository: AdminArticleCommentRepository,
  ) {}

  execute(input: ListAdminArticleCommentsInput = {}) {
    return this.adminArticleCommentRepository.list(normalizeListAdminArticleCommentsInput(input));
  }
}

function normalizeListAdminArticleCommentsInput(
  input: ListAdminArticleCommentsInput,
): ListAdminArticleCommentsFilters {
  return {
    articleId: normalizeOptionalText(input.articleId),
    articleSlug: normalizeOptionalText(input.articleSlug),
    articleTitle: normalizeOptionalText(input.articleTitle),
    author: normalizeOptionalText(input.author),
    body: normalizeOptionalText(input.body),
    commentId: normalizeOptionalText(input.commentId),
    createdFrom: normalizeOptionalDate(input.createdFrom),
    createdTo: normalizeOptionalDate(input.createdTo),
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
    search: normalizeOptionalText(input.search),
    sort: input.sort === "OLDEST" ? "OLDEST" : "NEWEST",
    status: normalizeStatus(input.status),
  };
}

function normalizeOptionalDate(value: Date | undefined) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : undefined;
}

function normalizeStatus(value: string | undefined): AdminArticleCommentStatus | undefined {
  return value === "HIDDEN" || value === "VISIBLE" ? value : undefined;
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

export { ListAdminArticleCommentsUseCase, normalizeListAdminArticleCommentsInput };
export type { ListAdminArticleCommentsInput };
