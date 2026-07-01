import { describe, expect, it } from "vitest";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";
import {
  ListPublishedArticlesUseCase,
  normalizeListInput,
} from "./list-published-articles.use-case";

describe("ListPublishedArticlesUseCase", () => {
  it("normalizes pagination before querying the repository", async () => {
    const repository = new CapturingArticleRepository();
    const useCase = new ListPublishedArticlesUseCase(repository);

    await useCase.execute({
      page: -1,
      pageSize: 500,
      categorySlug: " markdown ",
      tagSlug: " ",
      now: new Date("2026-07-02T00:00:00.000Z"),
    });

    expect(repository.lastFilters).toEqual({
      page: 1,
      pageSize: 50,
      categorySlug: "markdown",
      tagSlug: undefined,
      search: undefined,
      now: new Date("2026-07-02T00:00:00.000Z"),
    });
  });

  it("uses stable defaults for empty input", () => {
    expect(normalizeListInput({ now: new Date("2026-07-02T00:00:00.000Z") })).toEqual({
      page: 1,
      pageSize: 10,
      categorySlug: undefined,
      tagSlug: undefined,
      search: undefined,
      now: new Date("2026-07-02T00:00:00.000Z"),
    });
  });
});

class CapturingArticleRepository implements ArticleRepository {
  lastFilters: ListPublishedArticlesFilters | null = null;

  async findPublishedBySlug() {
    return null;
  }

  async listPublished(filters: ListPublishedArticlesFilters) {
    this.lastFilters = filters;
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
}
