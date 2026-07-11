import { describe, expect, it } from "vitest";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";
import {
  GetPublishedArticleCategoryUseCase,
  PublishedArticleCategoryNotFoundError,
} from "./get-published-article-category.use-case";

describe("GetPublishedArticleCategoryUseCase", () => {
  it("returns a public category with its published article count", async () => {
    const category = {
      description: "工程实践与开发记录",
      name: "开发笔记",
      publishedArticleCount: 3,
      slug: "development",
    };
    const useCase = new GetPublishedArticleCategoryUseCase(new StaticArticleRepository(category));

    await expect(useCase.execute(" development ")).resolves.toEqual(category);
  });

  it("rejects unknown categories", async () => {
    const useCase = new GetPublishedArticleCategoryUseCase(new StaticArticleRepository(null));

    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(
      PublishedArticleCategoryNotFoundError,
    );
  });
});

class StaticArticleRepository implements ArticleRepository {
  constructor(
    private readonly category: Awaited<
      ReturnType<ArticleRepository["findPublishedCategoryBySlug"]>
    >,
  ) {}

  async findPublishedCategoryBySlug() {
    return this.category;
  }

  async findPublishedBySlug() {
    return null;
  }

  async findPublishedTagBySlug() {
    return null;
  }

  async listPublished(filters: ListPublishedArticlesFilters) {
    return {
      data: [],
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  async listPublishedCategories() {
    return this.category ? [this.category] : [];
  }

  async listPublishedTags() {
    return { data: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } };
  }
}
