import type { AdminArticleEditorDraftResponse } from "@adrian-zephyr-notes/contracts";
import type { AdminArticleEditorDraft } from "../domain/admin-article-editor-draft.repository";

function toAdminArticleEditorDraftResponse(
  draft: AdminArticleEditorDraft,
): AdminArticleEditorDraftResponse {
  return {
    id: draft.id,
    articleId: draft.articleId,
    baseArticleUpdatedAt: draft.baseArticleUpdatedAt?.toISOString() ?? null,
    savedAt: draft.savedAt.toISOString(),
    values: draft.values,
  };
}

export { toAdminArticleEditorDraftResponse };
