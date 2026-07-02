import type { PaginatedResponse } from "./pagination.js";

type ArticleCommentsQuery = {
  page?: number;
  pageSize?: number;
};

type ArticleCommentAuthor = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type ArticleCommentResponse = {
  id: string;
  body: string;
  parentCommentId: string | null;
  author: ArticleCommentAuthor;
  replies: ArticleCommentResponse[];
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

type ArticleCommentsResponse = PaginatedResponse<ArticleCommentResponse>;

type ArticleCommentLikeResponse = {
  commentId: string;
  likeCount: number;
  likedByMe: boolean;
};

type CreateArticleCommentRequest = {
  body: string;
  parentCommentId?: string | null;
};

export type {
  ArticleCommentAuthor,
  ArticleCommentLikeResponse,
  ArticleCommentResponse,
  ArticleCommentsQuery,
  ArticleCommentsResponse,
  CreateArticleCommentRequest,
};
