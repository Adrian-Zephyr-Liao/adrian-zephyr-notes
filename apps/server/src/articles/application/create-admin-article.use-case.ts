import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";
import {
  assertAdminArticleTaxonomyInputExists,
  normalizeCreateAdminArticleInput,
  type CreateAdminArticleInput,
} from "./admin-article-input";
import { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

@Injectable()
class CreateAdminArticleUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
    private readonly queueArticleSummary: QueueArticleSummaryUseCase,
  ) {}

  async execute(input: CreateAdminArticleInput, now = new Date()) {
    const createInput = normalizeCreateAdminArticleInput(input, now);

    await assertAdminArticleTaxonomyInputExists(this.adminArticleRepository, createInput);

    const article = await this.adminArticleRepository.create(createInput);

    await this.queueArticleSummary.execute({
      articleId: article.id,
      title: article.title,
      description: article.description,
      markdown: article.markdown,
    });

    return article;
  }
}

export { CreateAdminArticleUseCase };
export type { CreateAdminArticleInput };
