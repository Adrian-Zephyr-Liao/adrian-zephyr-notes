import { randomUUID } from "node:crypto";
import type {
  AdminArticleDetail,
  CreateAdminArticleRepositoryInput,
  UpdateAdminArticleRepositoryInput,
} from "../domain/admin-article.repository";
import type { ArticleStatus } from "../domain/article-status";
import { ArticleSlug } from "../domain/value-objects/article-slug";
import { AdminArticleValidationError } from "./admin-article.errors";
import { calculateArticleReadingMetrics } from "./article-reading-metrics";

type AdminArticleTaxonomyOptionsReader = {
  listTaxonomyOptions(): Promise<{
    categories: { slug: string }[];
    tags: { slug: string }[];
  }>;
};

type CreateAdminArticleInput = {
  categorySlug?: string | null;
  coverImageUrl?: string | null;
  description: string;
  markdown: string;
  status?: string;
  tagSlugs?: string[];
  title: string;
};

type UpdateAdminArticleInput = {
  categorySlug?: string | null;
  coverImageUrl?: string | null;
  description?: string;
  id: string;
  markdown?: string;
  status?: string;
  tagSlugs?: string[];
  title?: string;
};

function normalizeCreateAdminArticleInput(
  input: CreateAdminArticleInput,
  now: Date,
): CreateAdminArticleRepositoryInput {
  const markdown = normalizeRequiredText(input.markdown, "Article markdown");
  const status = normalizeArticleStatus(input.status) ?? "DRAFT";

  return {
    slug: createShortArticleSlug(),
    title: normalizeRequiredText(input.title, "Article title"),
    description: normalizeArticleDescription(input.description, status),
    markdown,
    status,
    publishedAt: status === "PUBLISHED" ? now : null,
    categorySlug: normalizeOptionalText(input.categorySlug),
    tagSlugs: normalizeSlugList(input.tagSlugs ?? []),
    coverImageUrl: normalizeOptionalText(input.coverImageUrl),
    ...calculateArticleReadingMetrics(markdown),
  };
}

function normalizeUpdateAdminArticleInput(
  input: UpdateAdminArticleInput,
  current: AdminArticleDetail,
  now: Date,
): UpdateAdminArticleRepositoryInput {
  const markdown = normalizeOptionalRequiredText(input.markdown, "Article markdown");
  const status = normalizeArticleStatus(input.status);
  const nextStatus = status ?? current.status;
  const updateInput: UpdateAdminArticleRepositoryInput = {
    id: normalizeRequiredText(input.id, "Article id"),
  };

  if (input.title !== undefined) {
    updateInput.title = normalizeRequiredText(input.title, "Article title");
  }

  if (input.description !== undefined) {
    updateInput.description = normalizeArticleDescription(input.description, nextStatus);
  }

  if (markdown !== undefined) {
    updateInput.markdown = markdown;
    Object.assign(updateInput, calculateArticleReadingMetrics(markdown));
  }

  if (input.coverImageUrl !== undefined) {
    updateInput.coverImageUrl = normalizeOptionalText(input.coverImageUrl);
  }

  if (input.categorySlug !== undefined) {
    updateInput.categorySlug = normalizeOptionalText(input.categorySlug);
  }

  if (input.tagSlugs !== undefined) {
    updateInput.tagSlugs = normalizeSlugList(input.tagSlugs);
  }

  if (status !== undefined) {
    if (status === "PUBLISHED" && input.description === undefined && !current.description.trim()) {
      throw new AdminArticleValidationError("Article description cannot be empty.");
    }

    updateInput.status = status;
    updateInput.publishedAt = resolvePublishedAt(status, current, now);
  }

  return updateInput;
}

async function assertAdminArticleTaxonomyInputExists(
  repository: AdminArticleTaxonomyOptionsReader,
  input: {
    categorySlug?: string | null;
    tagSlugs?: string[];
  },
) {
  if (input.categorySlug === undefined && input.tagSlugs === undefined) {
    return;
  }

  const options = await repository.listTaxonomyOptions();

  if (
    input.categorySlug &&
    !options.categories.some((category) => category.slug === input.categorySlug)
  ) {
    throw new AdminArticleValidationError("Article category does not exist.");
  }

  const missingTagSlug = input.tagSlugs?.find(
    (tagSlug) => !options.tags.some((tag) => tag.slug === tagSlug),
  );

  if (missingTagSlug) {
    throw new AdminArticleValidationError("Article tag does not exist.");
  }
}

function createShortArticleSlug() {
  return ArticleSlug.create(randomUUID().replaceAll("-", "").slice(0, 8)).toString();
}

function resolvePublishedAt(status: ArticleStatus, current: AdminArticleDetail, now: Date) {
  if (status !== "PUBLISHED") {
    return null;
  }

  return current.publishedAt ?? now;
}

function normalizeArticleStatus(value: string | undefined): ArticleStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "ARCHIVED" || value === "DRAFT" || value === "PUBLISHED") {
    return value;
  }

  throw new AdminArticleValidationError("Unsupported article status.");
}

function normalizeOptionalRequiredText(value: string | undefined, fieldName: string) {
  return value === undefined ? undefined : normalizeRequiredText(value, fieldName);
}

function normalizeRequiredText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new AdminArticleValidationError(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeArticleDescription(value: string, status: ArticleStatus) {
  if (status === "DRAFT") {
    return value.trim();
  }

  return normalizeRequiredText(value, "Article description");
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

export {
  assertAdminArticleTaxonomyInputExists,
  normalizeCreateAdminArticleInput,
  normalizeUpdateAdminArticleInput,
};
export type { CreateAdminArticleInput, UpdateAdminArticleInput };
