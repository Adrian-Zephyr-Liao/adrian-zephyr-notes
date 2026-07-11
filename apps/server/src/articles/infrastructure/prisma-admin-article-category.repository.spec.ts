import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../database/prisma.service";
import { PrismaAdminArticleCategoryRepository } from "./prisma-admin-article-category.repository";

describe("PrismaAdminArticleCategoryRepository", () => {
  it("updates editor drafts when a category slug changes", async () => {
    const tx = {
      adminArticleEditorDraft: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      articleCategory: {
        findUnique: vi.fn().mockResolvedValue({ slug: "old-category" }),
        update: vi.fn().mockResolvedValue(categoryRecord({ slug: "new-category" })),
      },
    };
    const repository = new PrismaAdminArticleCategoryRepository(
      createPrismaDouble({
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      }),
    );

    await expect(repository.update("category-1", { slug: "new-category" })).resolves.toMatchObject({
      id: "category-1",
      slug: "new-category",
    });
    expect(tx.adminArticleEditorDraft.updateMany).toHaveBeenCalledWith({
      where: { categorySlug: "old-category" },
      data: { categorySlug: "new-category" },
    });
  });

  it("blocks deleting a category referenced by an editor draft", async () => {
    const tx = {
      adminArticleEditorDraft: { count: vi.fn().mockResolvedValue(1) },
      articleCategory: {
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          _count: { articles: 0 },
          slug: "category",
        }),
      },
    };
    const repository = new PrismaAdminArticleCategoryRepository(
      createPrismaDouble({
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      }),
    );

    await expect(repository.delete("category-1")).resolves.toBe("IN_USE");
    expect(tx.articleCategory.delete).not.toHaveBeenCalled();
  });
});

function categoryRecord({ slug }: { slug: string }) {
  return {
    _count: { articles: 0 },
    createdAt: new Date("2026-07-11T00:00:00.000Z"),
    description: "Description",
    id: "category-1",
    name: "Category",
    slug,
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
  };
}

function createPrismaDouble(value: object) {
  return value as unknown as PrismaService;
}
