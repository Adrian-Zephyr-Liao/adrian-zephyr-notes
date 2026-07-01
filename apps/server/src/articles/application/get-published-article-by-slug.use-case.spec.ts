import { describe, expect, it } from "vitest";
import { Article } from "../domain/article.entity";
import type { ArticleRepository, ListPublishedArticlesFilters } from "../domain/article.repository";
import { ArticleNotFoundError } from "./article-not-found.error";
import { GetPublishedArticleBySlugUseCase } from "./get-published-article-by-slug.use-case";

describe("GetPublishedArticleBySlugUseCase", () => {
  it("returns a published article by slug", async () => {
    const article = createArticle();
    const useCase = new GetPublishedArticleBySlugUseCase(new StaticArticleRepository(article));

    await expect(useCase.execute("5f7448b7", new Date("2026-07-02T00:00:00.000Z"))).resolves.toBe(
      article,
    );
  });

  it("throws a domain-level not found error for missing articles", async () => {
    const useCase = new GetPublishedArticleBySlugUseCase(new StaticArticleRepository(null));

    await expect(useCase.execute("5f7448b7")).rejects.toBeInstanceOf(ArticleNotFoundError);
  });
});

class StaticArticleRepository implements ArticleRepository {
  constructor(private readonly article: Article | null) {}

  async findPublishedBySlug() {
    return this.article;
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
}

function createArticle() {
  return Article.create({
    id: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    slug: "5f7448b7",
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
    status: "PUBLISHED",
    category: { slug: "markdown", name: "Markdown" },
    tags: [{ slug: "gfm", name: "GFM" }],
    coverImageUrl: null,
    wordCount: 1200,
    readingMinutes: 4,
    publishedAt: new Date("2026-07-02T10:00:00.000Z"),
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-02T10:00:00.000Z"),
  });
}
