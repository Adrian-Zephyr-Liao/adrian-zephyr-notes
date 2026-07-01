import { Inject, Injectable } from "@nestjs/common";
import { ARTICLE_REPOSITORY, type ArticleRepository } from "../domain/article.repository";
import { ArticleSlug } from "../domain/value-objects/article-slug";
import { ArticleNotFoundError } from "./article-not-found.error";

@Injectable()
class GetPublishedArticleBySlugUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
  ) {}

  async execute(slug: string, now = new Date()) {
    const articleSlug = ArticleSlug.create(slug);
    const article = await this.articleRepository.findPublishedBySlug(articleSlug.toString(), now);

    if (!article) {
      throw new ArticleNotFoundError(articleSlug.toString());
    }

    return article;
  }
}

export { GetPublishedArticleBySlugUseCase };
