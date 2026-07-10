type AdminArticleCommentStatus = "HIDDEN" | "VISIBLE";

type ListAdminArticleCommentsFilters = {
  commentId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: AdminArticleCommentStatus;
};

type AdminArticleCommentAuthor = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type AdminArticleCommentArticle = {
  id: string;
  slug: string;
  title: string;
};

type AdminArticleCommentParent = {
  id: string;
  body: string;
  author: AdminArticleCommentAuthor;
} | null;

type AdminArticleCommentListItem = {
  id: string;
  body: string;
  status: AdminArticleCommentStatus;
  parentCommentId: string | null;
  article: AdminArticleCommentArticle;
  author: AdminArticleCommentAuthor;
  parent: AdminArticleCommentParent;
  replyCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type AdminArticleCommentsPage = {
  data: AdminArticleCommentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type UpdateAdminArticleCommentStatusInput = {
  id: string;
  status: AdminArticleCommentStatus;
};

interface AdminArticleCommentRepository {
  list(filters: ListAdminArticleCommentsFilters): Promise<AdminArticleCommentsPage>;
  updateStatus(
    input: UpdateAdminArticleCommentStatusInput,
  ): Promise<AdminArticleCommentListItem | null>;
}

const ADMIN_ARTICLE_COMMENT_REPOSITORY = Symbol("ADMIN_ARTICLE_COMMENT_REPOSITORY");

export { ADMIN_ARTICLE_COMMENT_REPOSITORY };
export type {
  AdminArticleCommentArticle,
  AdminArticleCommentAuthor,
  AdminArticleCommentListItem,
  AdminArticleCommentParent,
  AdminArticleCommentRepository,
  AdminArticleCommentsPage,
  AdminArticleCommentStatus,
  ListAdminArticleCommentsFilters,
  UpdateAdminArticleCommentStatusInput,
};
