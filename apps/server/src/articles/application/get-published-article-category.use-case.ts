import { Inject, Injectable } from "@nestjs/common";
import { ARTICLE_REPOSITORY, type ArticleRepository } from "../domain/article.repository";

class PublishedArticleCategoryNotFoundError extends Error {}

@Injectable()
class GetPublishedArticleCategoryUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
  ) {}

  async execute(slug: string, now = new Date()) {
    const normalizedSlug = slug.trim();
    const category = normalizedSlug
      ? await this.articleRepository.findPublishedCategoryBySlug(normalizedSlug, now)
      : null;

    if (!category) {
      throw new PublishedArticleCategoryNotFoundError();
    }

    return category;
  }
}

export { GetPublishedArticleCategoryUseCase, PublishedArticleCategoryNotFoundError };
