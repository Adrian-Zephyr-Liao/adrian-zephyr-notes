import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_COMMENT_REPOSITORY,
  type ArticleCommentRepository,
} from "../domain/article-comment.repository";
import { ArticleCommentArticleNotFoundError } from "./article-comment.errors";
import {
  normalizeArticleCommentsQuery,
  type ArticleCommentsPaginationInput,
} from "./article-comments-pagination";

@Injectable()
class ListVisibleArticleCommentsUseCase<TComment = unknown> {
  constructor(
    @Inject(ARTICLE_COMMENT_REPOSITORY)
    private readonly articleCommentRepository: ArticleCommentRepository<TComment>,
  ) {}

  async execute(slug: string, input: ArticleCommentsPaginationInput = {}, now = new Date()) {
    const articleId = await this.articleCommentRepository.findPublicArticleIdBySlug(slug, now);

    if (!articleId) {
      throw new ArticleCommentArticleNotFoundError();
    }

    return this.articleCommentRepository.listVisibleByArticleId(
      articleId,
      normalizeArticleCommentsQuery(input),
    );
  }
}

export { ListVisibleArticleCommentsUseCase };
