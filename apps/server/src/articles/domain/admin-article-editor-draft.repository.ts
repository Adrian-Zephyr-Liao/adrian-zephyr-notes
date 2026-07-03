import type { ArticleStatus } from "./article-status";

type AdminArticleEditorDraftValues = {
  title: string;
  description: string;
  markdown: string;
  status: ArticleStatus;
  categorySlug: string;
  tagSlugs: string[];
  coverImageUrl: string;
};

type AdminArticleEditorDraft = {
  id: string;
  ownerUserId: string;
  articleId: string | null;
  baseArticleUpdatedAt: Date | null;
  savedAt: Date;
  values: AdminArticleEditorDraftValues;
};

type SaveAdminArticleEditorDraftRepositoryInput = {
  ownerUserId: string;
  articleId: string | null;
  baseArticleUpdatedAt: Date | null;
  clientSavedAt: Date;
  values: AdminArticleEditorDraftValues;
};

interface AdminArticleEditorDraftRepository {
  deleteCurrent(input: { articleId: string | null; ownerUserId: string }): Promise<boolean>;
  findCurrent(input: {
    articleId: string | null;
    ownerUserId: string;
  }): Promise<AdminArticleEditorDraft | null>;
  saveCurrent(input: SaveAdminArticleEditorDraftRepositoryInput): Promise<AdminArticleEditorDraft>;
}

function createAdminArticleEditorDraftScope(articleId: string | null) {
  return articleId ? `article:${articleId}` : "new";
}

const ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY = Symbol("ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY");

export { ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY, createAdminArticleEditorDraftScope };
export type {
  AdminArticleEditorDraft,
  AdminArticleEditorDraftRepository,
  AdminArticleEditorDraftValues,
  SaveAdminArticleEditorDraftRepositoryInput,
};
