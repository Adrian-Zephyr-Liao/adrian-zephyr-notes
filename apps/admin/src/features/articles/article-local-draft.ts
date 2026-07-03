import type { ArticleEditorValues } from "./article-editor";

const articleLocalDraftStorageVersion = 1;
const articleLocalDraftStoragePrefix = "az-notes:admin:article-draft";

type ArticleLocalDraftScope = {
  adminLogin: string;
  articleId?: string;
};

type ArticleLocalDraftRecord = {
  articleId: string | null;
  baseArticleUpdatedAt: string | null;
  savedAt: string;
  values: ArticleEditorValues;
  version: typeof articleLocalDraftStorageVersion;
};

type ArticleDraftCandidate = {
  savedAt: string;
  source: "cloud" | "local";
  values: ArticleEditorValues;
};

function createArticleLocalDraftKey(scope: ArticleLocalDraftScope) {
  const articleSegment = scope.articleId ? `article:${scope.articleId}` : "new";

  return [
    articleLocalDraftStoragePrefix,
    encodeURIComponent(scope.adminLogin),
    encodeURIComponent(articleSegment),
  ].join(":");
}

function createArticleLocalDraftRecord(input: {
  articleId?: string;
  baseArticleUpdatedAt?: string | null;
  savedAt?: Date;
  values: ArticleEditorValues;
}): ArticleLocalDraftRecord {
  return {
    articleId: input.articleId ?? null,
    baseArticleUpdatedAt: input.baseArticleUpdatedAt ?? null,
    savedAt: (input.savedAt ?? new Date()).toISOString(),
    values: input.values,
    version: articleLocalDraftStorageVersion,
  };
}

function readArticleLocalDraft(storage: Storage | undefined, key: string) {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    return isArticleLocalDraftRecord(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeArticleLocalDraft(
  storage: Storage | undefined,
  key: string,
  record: ArticleLocalDraftRecord,
) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(record));

    return true;
  } catch {
    return false;
  }
}

function removeArticleLocalDraft(storage: Storage | undefined, key: string) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);

    return true;
  } catch {
    return false;
  }
}

function shouldRestoreArticleLocalDraft(
  record: ArticleLocalDraftRecord,
  serverUpdatedAt: string | null | undefined,
) {
  return isDraftNewerThanServer(record.savedAt, serverUpdatedAt);
}

function pickLatestRestorableArticleDraft(
  candidates: Array<ArticleDraftCandidate | null>,
  serverValues: ArticleEditorValues,
  serverUpdatedAt: string | null | undefined,
) {
  return candidates
    .filter((candidate): candidate is ArticleDraftCandidate => Boolean(candidate))
    .filter(
      (candidate) =>
        isDraftNewerThanServer(candidate.savedAt, serverUpdatedAt) &&
        !areArticleEditorValuesEqual(candidate.values, serverValues),
    )
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))[0];
}

function isDraftNewerThanServer(draftSavedAt: string, serverUpdatedAt: string | null | undefined) {
  if (!serverUpdatedAt) {
    return true;
  }

  return Date.parse(draftSavedAt) > Date.parse(serverUpdatedAt);
}

function areArticleEditorValuesEqual(left: ArticleEditorValues, right: ArticleEditorValues) {
  return (
    JSON.stringify(normalizeComparableValues(left)) ===
    JSON.stringify(normalizeComparableValues(right))
  );
}

function normalizeComparableValues(values: ArticleEditorValues) {
  return {
    ...values,
    tagSlugs: [...values.tagSlugs].sort(),
  };
}

function isArticleLocalDraftRecord(value: unknown): value is ArticleLocalDraftRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ArticleLocalDraftRecord>;

  return (
    candidate.version === articleLocalDraftStorageVersion &&
    typeof candidate.savedAt === "string" &&
    (candidate.articleId === null || typeof candidate.articleId === "string") &&
    (candidate.baseArticleUpdatedAt === null ||
      typeof candidate.baseArticleUpdatedAt === "string") &&
    isArticleEditorValues(candidate.values)
  );
}

function isArticleEditorValues(value: unknown): value is ArticleEditorValues {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ArticleEditorValues>;

  return (
    typeof candidate.categorySlug === "string" &&
    typeof candidate.coverImageUrl === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.markdown === "string" &&
    isArticleStatus(candidate.status) &&
    Array.isArray(candidate.tagSlugs) &&
    candidate.tagSlugs.every((tagSlug) => typeof tagSlug === "string") &&
    typeof candidate.title === "string"
  );
}

function isArticleStatus(value: unknown) {
  return value === "ARCHIVED" || value === "DRAFT" || value === "PUBLISHED";
}

export {
  areArticleEditorValuesEqual,
  createArticleLocalDraftKey,
  createArticleLocalDraftRecord,
  pickLatestRestorableArticleDraft,
  readArticleLocalDraft,
  removeArticleLocalDraft,
  shouldRestoreArticleLocalDraft,
  writeArticleLocalDraft,
};
export type { ArticleDraftCandidate, ArticleLocalDraftRecord };
