import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleDetail,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";
import { AdminArticleNotFoundError } from "./admin-article.errors";
import {
  assertAdminArticleTaxonomyInputExists,
  normalizeUpdateAdminArticleInput,
  type UpdateAdminArticleInput,
} from "./admin-article-input";
import { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

@Injectable()
class UpdateAdminArticleUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
    private readonly queueArticleSummary: QueueArticleSummaryUseCase,
  ) {}

  async execute(input: UpdateAdminArticleInput, now = new Date()) {
    const current = await this.adminArticleRepository.findById(input.id);

    if (!current) {
      throw new AdminArticleNotFoundError();
    }

    const updateInput = normalizeUpdateAdminArticleInput(input, current, now);

    await assertAdminArticleTaxonomyInputExists(this.adminArticleRepository, updateInput);

    const updated = await this.adminArticleRepository.update(updateInput);

    if (!updated) {
      throw new AdminArticleNotFoundError();
    }

    if (didSummaryContentChange(current, updated)) {
      await this.queueArticleSummary.execute({
        articleId: updated.id,
        title: updated.title,
        description: updated.description,
        markdown: updated.markdown,
      });
    }

    return updated;
  }
}

function didSummaryContentChange(before: AdminArticleDetail, after: AdminArticleDetail) {
  return (
    before.title !== after.title ||
    before.description !== after.description ||
    before.markdown !== after.markdown
  );
}

export { UpdateAdminArticleUseCase, didSummaryContentChange, normalizeUpdateAdminArticleInput };
export type { UpdateAdminArticleInput };
