import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY,
  type AdminArticleEditorDraftRepository,
} from "../domain/admin-article-editor-draft.repository";

@Injectable()
class GetCurrentAdminArticleEditorDraftUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY)
    private readonly articleEditorDraftRepository: AdminArticleEditorDraftRepository,
  ) {}

  execute(input: { articleId?: string | null; ownerUserId: string }) {
    return this.articleEditorDraftRepository.findCurrent({
      ownerUserId: input.ownerUserId,
      articleId: normalizeOptionalText(input.articleId),
    });
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export { GetCurrentAdminArticleEditorDraftUseCase };
