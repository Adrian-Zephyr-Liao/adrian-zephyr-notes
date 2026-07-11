import { describe, expect, it, vi } from "vitest";
import type { AdminArticleCategoryRepository } from "../domain/admin-article-category.repository";
import {
  AdminArticleCategoryInUseError,
  AdminArticleCategoryNotFoundError,
  AdminArticleCategoryValidationError,
} from "../domain/admin-article-category.repository";
import {
  CreateAdminArticleCategoryUseCase,
  DeleteAdminArticleCategoryUseCase,
  ListAdminArticleCategoriesUseCase,
  UpdateAdminArticleCategoryUseCase,
} from "./admin-article-category.use-cases";

describe("admin article category use cases", () => {
  it("normalizes category creation input", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleCategoryUseCase(repository);

    await useCase.execute({
      description: "  Engineering notes  ",
      name: "  Engineering  ",
      slug: "  engineering-notes  ",
    });

    expect(repository.create).toHaveBeenCalledWith({
      description: "Engineering notes",
      name: "Engineering",
      slug: "engineering-notes",
    });
  });

  it("rejects category slugs that are not URL safe", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleCategoryUseCase(repository);

    await expect(
      useCase.execute({ name: "Engineering", slug: "Engineering Notes" }),
    ).rejects.toBeInstanceOf(AdminArticleCategoryValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("normalizes category list pagination and search", async () => {
    const repository = createRepositoryDouble();
    const useCase = new ListAdminArticleCategoriesUseCase(repository);

    await useCase.execute({ page: 0, pageSize: 100, q: "  notes  " });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "notes",
    });
  });

  it("reports missing and in-use categories during deletion", async () => {
    const missingRepository = createRepositoryDouble("NOT_FOUND");
    const inUseRepository = createRepositoryDouble("IN_USE");

    await expect(
      new DeleteAdminArticleCategoryUseCase(missingRepository).execute("missing"),
    ).rejects.toBeInstanceOf(AdminArticleCategoryNotFoundError);
    await expect(
      new DeleteAdminArticleCategoryUseCase(inUseRepository).execute("used"),
    ).rejects.toBeInstanceOf(AdminArticleCategoryInUseError);
  });

  it("requires at least one field when updating", async () => {
    const repository = createRepositoryDouble();
    const useCase = new UpdateAdminArticleCategoryUseCase(repository);

    await expect(useCase.execute("category-1", {})).rejects.toBeInstanceOf(
      AdminArticleCategoryValidationError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});

function createRepositoryDouble(deleteResult: "DELETED" | "IN_USE" | "NOT_FOUND" = "DELETED") {
  return {
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(deleteResult),
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    }),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as AdminArticleCategoryRepository & {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}
