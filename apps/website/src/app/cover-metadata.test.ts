import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata as homeMetadata } from "./page";
import { generateMetadata as postMetadata } from "./posts/[slug]/page";

const api = vi.hoisted(() => ({ getArticles: vi.fn(), getArticleBySlug: vi.fn() }));
vi.mock("@/lib/articles-api", () => api);
vi.mock("@/features/home", () => ({ HomeContent: () => null }));
vi.mock("@/features/article-reading", () => ({ ArticleReading: () => null }));

beforeEach(() => vi.resetAllMocks());

describe("article cover metadata", () => {
  it.each(["https://", "//example.com/image.png", "javascript:alert(1)"])(
    "omits malformed stored cover metadata without losing page metadata: %s",
    async (coverImageUrl) => {
      const post = { title: "一页笔记", description: "阅读笔记", coverImageUrl };
      api.getArticles.mockResolvedValue({ data: [post] });
      api.getArticleBySlug.mockResolvedValue(post);

      const home = await homeMetadata();
      const article = await postMetadata({ params: Promise.resolve({ slug: "one" }) });

      expect(home.openGraph?.images).toEqual([]);
      expect(article.openGraph?.images).toEqual([]);
      expect(article.twitter?.images).toEqual([]);
      expect(article.title).toBe("一页笔记 | Adrian Zephyr Notes");
    },
  );

  it("keeps supported cover URLs in sharing metadata", async () => {
    const coverImageUrl = "https://img.zephyrai.site/cover.webp";
    api.getArticleBySlug.mockResolvedValue({ title: "一页笔记", coverImageUrl });

    const article = await postMetadata({ params: Promise.resolve({ slug: "one" }) });

    expect(article.openGraph?.images).toEqual([{ url: coverImageUrl, alt: "一页笔记" }]);
    expect(article.twitter?.images).toEqual([coverImageUrl]);
  });
});
