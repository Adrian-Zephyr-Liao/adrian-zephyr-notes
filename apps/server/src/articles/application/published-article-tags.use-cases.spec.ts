import { describe, expect, it } from "vitest";
import type { ArticleRepository } from "../domain/article.repository";
import {
  GetPublishedArticleTagUseCase,
  ListPublishedArticleTagsUseCase,
  PublishedArticleTagNotFoundError,
} from "./published-article-tags.use-cases";

describe("published article tag use cases", () => {
  it("lists public tags", async () => {
    const repository = new TagRepository();
    await expect(new ListPublishedArticleTagsUseCase(repository).execute()).resolves.toMatchObject({
      data: repository.tags,
      pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
    });
  });

  it("rejects an unknown tag", async () => {
    const repository = new TagRepository();
    await expect(
      new GetPublishedArticleTagUseCase(repository).execute("missing"),
    ).rejects.toBeInstanceOf(PublishedArticleTagNotFoundError);
  });
});

class TagRepository implements ArticleRepository {
  tags = [{ name: "Markdown", publishedArticleCount: 2, slug: "markdown" }];
  async findPublishedCategoryBySlug() {
    return null;
  }
  async findPublishedBySlug() {
    return null;
  }
  async findPublishedTagBySlug(slug: string) {
    return this.tags.find((tag) => tag.slug === slug) ?? null;
  }
  async listPublished() {
    return { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } };
  }
  async listPublishedCategories() {
    return [];
  }
  async listPublishedTags() {
    return {
      data: this.tags,
      pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
    };
  }
}
