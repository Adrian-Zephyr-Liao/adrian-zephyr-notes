import type { PaginatedResponse } from "../public/pagination.js";

type AdminArticleCommentStatus = "HIDDEN" | "VISIBLE";

type AdminArticleCommentListQuery = {
  commentId?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  status?: AdminArticleCommentStatus | "ALL";
};

type AdminArticleCommentAuthorResponse = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type AdminArticleCommentArticleResponse = {
  id: string;
  slug: string;
  title: string;
};

type AdminArticleCommentParentResponse = {
  id: string;
  body: string;
  author: AdminArticleCommentAuthorResponse;
} | null;

type AdminArticleCommentListItemResponse = {
  id: string;
  body: string;
  status: AdminArticleCommentStatus;
  parentCommentId: string | null;
  article: AdminArticleCommentArticleResponse;
  author: AdminArticleCommentAuthorResponse;
  parent: AdminArticleCommentParentResponse;
  replyCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

type AdminArticleCommentListResponse = PaginatedResponse<AdminArticleCommentListItemResponse>;

type UpdateAdminArticleCommentRequest = {
  status: AdminArticleCommentStatus;
};

export type {
  AdminArticleCommentArticleResponse,
  AdminArticleCommentAuthorResponse,
  AdminArticleCommentListItemResponse,
  AdminArticleCommentListQuery,
  AdminArticleCommentListResponse,
  AdminArticleCommentParentResponse,
  AdminArticleCommentStatus,
  UpdateAdminArticleCommentRequest,
};
