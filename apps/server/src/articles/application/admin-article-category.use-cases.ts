import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_CATEGORY_REPOSITORY,
  AdminArticleCategoryInUseError,
  AdminArticleCategoryNotFoundError,
  AdminArticleCategoryValidationError,
  type AdminArticleCategoryRepository,
  type AdminArticleCategoryWriteInput,
} from "../domain/admin-article-category.repository";

type AdminArticleCategoryInput = {
  description?: string | null;
  name: string;
  slug: string;
};

@Injectable()
class CreateAdminArticleCategoryUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_CATEGORY_REPOSITORY)
    private readonly repository: AdminArticleCategoryRepository,
  ) {}

  async execute(input: AdminArticleCategoryInput) {
    return await this.repository.create(normalizeCategoryInput(input));
  }
}

@Injectable()
class ListAdminArticleCategoriesUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_CATEGORY_REPOSITORY)
    private readonly repository: AdminArticleCategoryRepository,
  ) {}

  execute(input: { page?: number; pageSize?: number; q?: string } = {}) {
    return this.repository.list({
      page: normalizePositiveInteger(input.page, 1),
      pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
      search: normalizeOptionalText(input.q) ?? undefined,
    });
  }
}

@Injectable()
class UpdateAdminArticleCategoryUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_CATEGORY_REPOSITORY)
    private readonly repository: AdminArticleCategoryRepository,
  ) {}

  async execute(id: string, input: Partial<AdminArticleCategoryInput>) {
    const categoryId = normalizeRequiredText(id, "Article category id");
    const update: Partial<AdminArticleCategoryWriteInput> = {};

    if (input.name !== undefined) {
      update.name = normalizeRequiredText(input.name, "Article category name");
    }

    if (input.slug !== undefined) {
      update.slug = normalizeCategorySlug(input.slug);
    }

    if (input.description !== undefined) {
      update.description = normalizeOptionalText(input.description);
    }

    if (Object.keys(update).length === 0) {
      throw new AdminArticleCategoryValidationError(
        "Article category update requires at least one field.",
      );
    }

    const category = await this.repository.update(categoryId, update);

    if (!category) {
      throw new AdminArticleCategoryNotFoundError();
    }

    return category;
  }
}

@Injectable()
class DeleteAdminArticleCategoryUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_CATEGORY_REPOSITORY)
    private readonly repository: AdminArticleCategoryRepository,
  ) {}

  async execute(id: string) {
    const result = await this.repository.delete(normalizeRequiredText(id, "Article category id"));

    if (result === "NOT_FOUND") {
      throw new AdminArticleCategoryNotFoundError();
    }

    if (result === "IN_USE") {
      throw new AdminArticleCategoryInUseError();
    }
  }
}

function normalizeCategoryInput(input: AdminArticleCategoryInput): AdminArticleCategoryWriteInput {
  return {
    description: normalizeOptionalText(input.description),
    name: normalizeRequiredText(input.name, "Article category name"),
    slug: normalizeCategorySlug(input.slug),
  };
}

function normalizeCategorySlug(value: string) {
  const slug = normalizeRequiredText(value, "Article category slug");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new AdminArticleCategoryValidationError(
      "Article category slug must use lowercase letters, numbers, and hyphens.",
    );
  }

  return slug;
}

function normalizeRequiredText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new AdminArticleCategoryValidationError(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

export {
  CreateAdminArticleCategoryUseCase,
  DeleteAdminArticleCategoryUseCase,
  ListAdminArticleCategoriesUseCase,
  UpdateAdminArticleCategoryUseCase,
};
