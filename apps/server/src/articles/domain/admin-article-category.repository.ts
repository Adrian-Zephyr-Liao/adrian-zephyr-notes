type AdminArticleCategory = {
  articleCount: number;
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
};

type AdminArticleCategoryPage = {
  data: AdminArticleCategory[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type AdminArticleCategoryWriteInput = {
  description: string | null;
  name: string;
  slug: string;
};

interface AdminArticleCategoryRepository {
  create(input: AdminArticleCategoryWriteInput): Promise<AdminArticleCategory>;
  delete(id: string): Promise<"DELETED" | "IN_USE" | "NOT_FOUND">;
  list(input: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<AdminArticleCategoryPage>;
  update(
    id: string,
    input: Partial<AdminArticleCategoryWriteInput>,
  ): Promise<AdminArticleCategory | null>;
}

class AdminArticleCategoryConflictError extends Error {
  constructor() {
    super("Article category name or slug already exists.");
  }
}

class AdminArticleCategoryInUseError extends Error {
  constructor() {
    super("Article category is still used by articles.");
  }
}

class AdminArticleCategoryNotFoundError extends Error {
  constructor() {
    super("Article category not found.");
  }
}

class AdminArticleCategoryValidationError extends Error {}

const ADMIN_ARTICLE_CATEGORY_REPOSITORY = Symbol("ADMIN_ARTICLE_CATEGORY_REPOSITORY");

export {
  ADMIN_ARTICLE_CATEGORY_REPOSITORY,
  AdminArticleCategoryConflictError,
  AdminArticleCategoryInUseError,
  AdminArticleCategoryNotFoundError,
  AdminArticleCategoryValidationError,
};
export type {
  AdminArticleCategory,
  AdminArticleCategoryPage,
  AdminArticleCategoryRepository,
  AdminArticleCategoryWriteInput,
};
