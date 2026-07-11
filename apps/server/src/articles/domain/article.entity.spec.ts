import { describe, expect, it } from "vitest";
import { Article } from "./article.entity";

describe("Article", () => {
  it("marks published articles visible only after their publish time", () => {
    const article = createArticle({
      status: "PUBLISHED",
      publishedAt: new Date("2026-07-02T10:00:00.000Z"),
    });

    expect(article.isPubliclyVisible(new Date("2026-07-02T09:59:59.999Z"))).toBe(false);
    expect(article.isPubliclyVisible(new Date("2026-07-02T10:00:00.000Z"))).toBe(true);
  });

  it("keeps draft articles hidden even when timestamps are present", () => {
    const article = createArticle({
      status: "DRAFT",
      publishedAt: new Date("2026-07-02T10:00:00.000Z"),
    });

    expect(article.isPubliclyVisible(new Date("2026-07-03T10:00:00.000Z"))).toBe(false);
  });

  it("rejects published articles without a publish time", () => {
    expect(() =>
      createArticle({
        status: "PUBLISHED",
        publishedAt: null,
      }),
    ).toThrow("Published articles must have a publishedAt timestamp.");
  });

  it("rejects unsafe slugs", () => {
    expect(() => createArticle({ slug: "Markdown Syntax" })).toThrow(
      "Article slug must be 3-80 lowercase URL-safe characters.",
    );
  });

  it("requires attribution for published reposts", () => {
    expect(() =>
      createArticle({
        origin: "REPOSTED",
        source: null,
      }),
    ).toThrow("Reposted articles require source attribution.");
  });
});

function createArticle(overrides: Partial<Parameters<typeof Article.create>[0]> = {}) {
  return Article.create({
    id: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    slug: "5f7448b7",
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
    origin: "ORIGINAL",
    status: "PUBLISHED",
    source: null,
    category: { slug: "markdown", name: "Markdown" },
    tags: [{ slug: "gfm", name: "GFM" }],
    coverImageUrl: null,
    wordCount: 1200,
    readingMinutes: 4,
    publishedAt: new Date("2026-07-02T10:00:00.000Z"),
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-02T10:00:00.000Z"),
    ...overrides,
  });
}
