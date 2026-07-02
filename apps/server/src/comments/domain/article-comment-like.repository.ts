type ArticleCommentLikeState = {
  commentId: string;
  likeCount: number;
  likedByMe: boolean;
};

interface ArticleCommentLikeRepository {
  likeVisibleComment(commentId: string, userId: string): Promise<ArticleCommentLikeState | null>;
  unlikeVisibleComment(commentId: string, userId: string): Promise<ArticleCommentLikeState | null>;
}

const ARTICLE_COMMENT_LIKE_REPOSITORY = Symbol("ARTICLE_COMMENT_LIKE_REPOSITORY");

export {
  ARTICLE_COMMENT_LIKE_REPOSITORY,
  type ArticleCommentLikeRepository,
  type ArticleCommentLikeState,
};
