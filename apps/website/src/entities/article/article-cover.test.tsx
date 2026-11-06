// @vitest-environment jsdom

import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleCover } from "./article-cover";

const article = {
  id: "article-1",
  title: "一页笔记",
  slug: "article-1",
  category: { slug: "engineering", name: "工程实践" },
  description: "工程实践中的一页笔记",
  origin: "ORIGINAL",
  source: null,
  tags: [],
  coverImageUrl: null,
  wordCount: 300,
  readingMinutes: 1,
  publishedAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
} satisfies ArticleListItemResponse;

afterEach(cleanup);

describe("ArticleCover", () => {
  it.each(["https://", "//example.com/cover.png", "javascript:alert(1)", "not a URL"])(
    "keeps the article readable when a stored cover URL is invalid: %s",
    (coverImageUrl) => {
      render(<ArticleCover article={{ ...article, coverImageUrl }} />);
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.getByText("工程实践")).not.toBeNull();
    },
  );

  it("retries a failed CDN optimization once with the original image, then shows a fallback", () => {
    const coverImageUrl = "https://img.zephyrai.site/cover.webp";
    render(<ArticleCover article={{ ...article, coverImageUrl }} />);
    const optimized = screen.getByRole("img");
    expect(optimized.getAttribute("src")).toContain("/_next/image?");

    fireEvent.error(optimized);
    const original = screen.getByRole("img");
    expect(original.getAttribute("src")).toBe(coverImageUrl);
    fireEvent.error(original);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("工程实践")).not.toBeNull();
  });

  it("loads a new source after the previous source failed", () => {
    const page = render(
      <ArticleCover article={{ ...article, coverImageUrl: "https://example.com/old.png" }} />,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();

    page.rerender(
      <ArticleCover article={{ ...article, coverImageUrl: "https://example.com/new.png" }} />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/new.png");
  });
});
