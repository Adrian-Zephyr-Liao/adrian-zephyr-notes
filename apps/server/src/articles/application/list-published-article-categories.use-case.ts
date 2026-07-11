import { Inject, Injectable } from "@nestjs/common";
import { ARTICLE_REPOSITORY, type ArticleRepository } from "../domain/article.repository";

@Injectable()
class ListPublishedArticleCategoriesUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
  ) {}

  execute(now = new Date()) {
    return this.articleRepository.listPublishedCategories(now);
  }
}

export { ListPublishedArticleCategoriesUseCase };
