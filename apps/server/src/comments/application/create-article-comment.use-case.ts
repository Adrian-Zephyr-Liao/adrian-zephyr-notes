import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_COMMENT_REPOSITORY,
  type ArticleCommentRepository,
  type CurrentCommentUser,
} from "../domain/article-comment.repository";
import { ArticleCommentBody } from "../domain/article-comment.entity";
import {
  ArticleCommentArticleNotFoundError,
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentParentNotFoundError,
} from "./article-comment.errors";

@Injectable()
class CreateArticleCommentUseCase<TComment = unknown> {
  constructor(
    @Inject(ARTICLE_COMMENT_REPOSITORY)
    private readonly articleCommentRepository: ArticleCommentRepository<TComment>,
  ) {}

  async execute(input: {
    slug: string;
    body: string;
    parentCommentId?: string | null;
    user: CurrentCommentUser | null;
    now?: Date;
  }) {
    if (!input.user) {
      throw new ArticleCommentAuthenticationRequiredError();
    }

    const body = ArticleCommentBody.create(input.body);
    const articleId = await this.articleCommentRepository.findPublicArticleIdBySlug(
      input.slug,
      input.now ?? new Date(),
    );

    if (!articleId) {
      throw new ArticleCommentArticleNotFoundError();
    }

    const parentCommentId = input.parentCommentId ?? null;

    if (parentCommentId) {
      const parentArticleId =
        await this.articleCommentRepository.findVisibleCommentArticleIdById(parentCommentId);

      if (parentArticleId !== articleId) {
        throw new ArticleCommentParentNotFoundError();
      }
    }

    return this.articleCommentRepository.create({
      articleId,
      authorId: input.user.id,
      body: body.toString(),
      parentCommentId,
    });
  }
}

export { CreateArticleCommentUseCase };
