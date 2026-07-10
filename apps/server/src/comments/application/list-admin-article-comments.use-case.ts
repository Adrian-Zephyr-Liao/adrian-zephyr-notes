import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_COMMENT_REPOSITORY,
  type AdminArticleCommentRepository,
  type AdminArticleCommentStatus,
  type ListAdminArticleCommentsFilters,
} from "../domain/admin-article-comment.repository";

type ListAdminArticleCommentsInput = {
  commentId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
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
    commentId: normalizeOptionalText(input.commentId),
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
    search: normalizeOptionalText(input.search),
    status: normalizeStatus(input.status),
  };
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
