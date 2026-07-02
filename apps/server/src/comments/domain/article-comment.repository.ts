type ArticleCommentsListInput = {
  page: number;
  pageSize: number;
  viewerUserId?: string | null;
};

type ArticleCommentsPage<TComment> = {
  data: TComment[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type CreateArticleCommentInput = {
  articleId: string;
  authorId: string;
  body: string;
  parentCommentId: string | null;
};

interface ArticleCommentRepository<TComment = unknown, TCommentTree = TComment> {
  findPublicArticleIdBySlug(slug: string, now: Date): Promise<string | null>;
  findVisibleCommentArticleIdById(commentId: string): Promise<string | null>;
  listVisibleByArticleId(
    articleId: string,
    input: ArticleCommentsListInput,
  ): Promise<ArticleCommentsPage<TCommentTree>>;
  create(input: CreateArticleCommentInput): Promise<TComment>;
}

const ARTICLE_COMMENT_REPOSITORY = Symbol("ARTICLE_COMMENT_REPOSITORY");

type CurrentCommentUser = {
  id: string;
};

export {
  ARTICLE_COMMENT_REPOSITORY,
  type ArticleCommentRepository,
  type ArticleCommentsListInput,
  type ArticleCommentsPage,
  type CreateArticleCommentInput,
  type CurrentCommentUser,
};
