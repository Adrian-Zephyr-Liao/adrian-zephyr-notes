import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY,
  type AdminArticleEditorDraftRepository,
} from "../domain/admin-article-editor-draft.repository";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";
import { AdminArticleNotFoundError } from "./admin-article.errors";
import { assertAdminArticleTaxonomyInputExists } from "./admin-article-input";
import {
  normalizeSaveAdminArticleEditorDraftInput,
  type SaveAdminArticleEditorDraftInput,
} from "./admin-article-editor-draft-input";

@Injectable()
class SaveCurrentAdminArticleEditorDraftUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY)
    private readonly articleEditorDraftRepository: AdminArticleEditorDraftRepository,
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
  ) {}

  async execute(input: SaveAdminArticleEditorDraftInput) {
    const saveInput = normalizeSaveAdminArticleEditorDraftInput(input);

    if (saveInput.values.categorySlug || saveInput.values.tagSlugs.length > 0) {
      await assertAdminArticleTaxonomyInputExists(this.adminArticleRepository, {
        categorySlug: saveInput.values.categorySlug || null,
        tagSlugs: saveInput.values.tagSlugs,
      });
    }

    if (saveInput.articleId) {
      const article = await this.adminArticleRepository.findById(saveInput.articleId);

      if (!article) {
        throw new AdminArticleNotFoundError();
      }
    }

    return this.articleEditorDraftRepository.saveCurrent(saveInput);
  }
}

export { SaveCurrentAdminArticleEditorDraftUseCase };
