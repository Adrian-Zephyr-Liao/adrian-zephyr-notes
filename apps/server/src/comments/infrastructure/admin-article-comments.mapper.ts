import type {
  AdminArticleCommentListItemResponse,
  AdminArticleCommentListResponse,
} from "@adrian-zephyr-notes/contracts";
import type {
  AdminArticleCommentListItem,
  AdminArticleCommentsPage,
} from "../domain/admin-article-comment.repository";

function toAdminArticleCommentListResponse(
  page: AdminArticleCommentsPage,
): AdminArticleCommentListResponse {
  return {
    data: page.data.map(toAdminArticleCommentListItemResponse),
    pagination: page.pagination,
  };
}

function toAdminArticleCommentListItemResponse(
  comment: AdminArticleCommentListItem,
): AdminArticleCommentListItemResponse {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export { toAdminArticleCommentListItemResponse, toAdminArticleCommentListResponse };
