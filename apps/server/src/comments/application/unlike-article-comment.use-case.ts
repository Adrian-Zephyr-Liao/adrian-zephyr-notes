import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_COMMENT_LIKE_REPOSITORY,
  type ArticleCommentLikeRepository,
} from "../domain/article-comment-like.repository";
import type { CurrentCommentUser } from "../domain/article-comment.repository";
import {
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentLikeTargetNotFoundError,
} from "./article-comment.errors";

@Injectable()
class UnlikeArticleCommentUseCase {
  constructor(
    @Inject(ARTICLE_COMMENT_LIKE_REPOSITORY)
    private readonly articleCommentLikeRepository: ArticleCommentLikeRepository,
  ) {}

  async execute(input: { commentId: string; user: CurrentCommentUser | null }) {
    if (!input.user) {
      throw new ArticleCommentAuthenticationRequiredError();
    }

    const likeState = await this.articleCommentLikeRepository.unlikeVisibleComment(
      input.commentId,
      input.user.id,
    );

    if (!likeState) {
      throw new ArticleCommentLikeTargetNotFoundError();
    }

    return likeState;
  }
}

export { UnlikeArticleCommentUseCase };
