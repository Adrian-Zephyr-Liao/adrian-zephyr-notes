import type { ArticleStatus } from "../domain/article-status";
import { AdminArticleValidationError } from "./admin-article.errors";
import type {
  AdminArticleEditorDraftValues,
  SaveAdminArticleEditorDraftRepositoryInput,
} from "../domain/admin-article-editor-draft.repository";

type SaveAdminArticleEditorDraftInput = {
  articleId?: string | null;
  baseArticleUpdatedAt?: string | null;
  clientSavedAt: string;
  ownerUserId: string;
  values: {
    categorySlug: string;
    coverImageUrl: string;
    description: string;
    markdown: string;
    status: string;
    origin?: string;
    sourceAuthor?: string;
    sourceName?: string;
    sourceUrl?: string;
    tagSlugs: string[];
    title: string;
  };
};

function normalizeSaveAdminArticleEditorDraftInput(
  input: SaveAdminArticleEditorDraftInput,
): SaveAdminArticleEditorDraftRepositoryInput {
  return {
    ownerUserId: normalizeRequiredText(input.ownerUserId, "Owner user id"),
    articleId: normalizeOptionalText(input.articleId),
    baseArticleUpdatedAt: normalizeOptionalDate(
      input.baseArticleUpdatedAt,
      "Base article updated at",
    ),
    clientSavedAt: normalizeRequiredDate(input.clientSavedAt, "Client saved at"),
    values: normalizeDraftValues(input.values),
  };
}

function normalizeDraftValues(
  values: SaveAdminArticleEditorDraftInput["values"],
): AdminArticleEditorDraftValues {
  return {
    categorySlug: normalizeOptionalText(values.categorySlug) ?? "",
    coverImageUrl: normalizeOptionalText(values.coverImageUrl) ?? "",
    description: values.description.trim(),
    markdown: values.markdown,
    origin: normalizeArticleOrigin(values.origin),
    sourceAuthor: normalizeOptionalText(values.sourceAuthor) ?? "",
    sourceName: normalizeOptionalText(values.sourceName) ?? "",
    sourceUrl: normalizeOptionalText(values.sourceUrl) ?? "",
    status: normalizeArticleStatus(values.status),
    tagSlugs: normalizeSlugList(values.tagSlugs),
    title: values.title.trim(),
  };
}

function normalizeArticleStatus(value: string): ArticleStatus {
  if (value === "ARCHIVED" || value === "DRAFT" || value === "PUBLISHED") {
    return value;
  }

  throw new AdminArticleValidationError("Unsupported draft article status.");
}

function normalizeArticleOrigin(value: string | undefined) {
  if (value === undefined) {
    return "ORIGINAL";
  }

  if (value === "ORIGINAL" || value === "REPOSTED") {
    return value;
  }

  throw new AdminArticleValidationError("Unsupported draft article origin.");
}

function normalizeOptionalDate(value: string | null | undefined, fieldName: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new AdminArticleValidationError(`${fieldName} must be a valid date.`);
  }

  return date;
}

function normalizeRequiredDate(value: string, fieldName: string) {
  const normalized = normalizeRequiredText(value, fieldName);
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new AdminArticleValidationError(`${fieldName} must be a valid date.`);
  }

  return date;
}

function normalizeRequiredText(value: string | null | undefined, fieldName: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new AdminArticleValidationError(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeSlugList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

export { normalizeSaveAdminArticleEditorDraftInput };
export type { SaveAdminArticleEditorDraftInput };
