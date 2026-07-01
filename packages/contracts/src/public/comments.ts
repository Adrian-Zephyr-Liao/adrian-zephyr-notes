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
  createdAt: string;
  updatedAt: string;
};

type ArticleCommentsResponse = PaginatedResponse<ArticleCommentResponse>;

type CreateArticleCommentRequest = {
  body: string;
  parentCommentId?: string | null;
};

export type {
  ArticleCommentAuthor,
  ArticleCommentResponse,
  ArticleCommentsQuery,
  ArticleCommentsResponse,
  CreateArticleCommentRequest,
};
