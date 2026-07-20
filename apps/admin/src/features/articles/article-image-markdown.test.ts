import { describe, expect, it } from "vitest";
import { insertArticleImageMarkdown, toArticleImageAltText } from "./article-image-markdown";

describe("article image Markdown", () => {
  it("inserts an image at the saved selection and returns the next cursor position", () => {
    const result = insertArticleImageMarkdown({
      alt: "architecture",
      markdown: "before after",
      selectionEnd: 7,
      selectionStart: 7,
      url: "https://img.zephyrai.site/articles/2026/07/image.png",
    });

    expect(result.markdown).toBe(
      "before ![architecture](https://img.zephyrai.site/articles/2026/07/image.png)after",
    );
    expect(result.selectionStart).toBe(result.selectionEnd);
    expect(result.selectionStart).toBe(
      "before ![architecture](https://img.zephyrai.site/articles/2026/07/image.png)".length,
    );
  });

  it("replaces a selection and escapes Markdown control characters in alt text", () => {
    expect(
      insertArticleImageMarkdown({
        alt: "diagram [draft] \\ v2",
        markdown: "replace this text",
        selectionEnd: 12,
        selectionStart: 0,
        url: "https://img.zephyrai.site/image.webp",
      }).markdown,
    ).toBe("![diagram \\[draft\\] \\\\ v2](https://img.zephyrai.site/image.webp) text");
  });

  it("derives readable alt text from the original filename", () => {
    expect(toArticleImageAltText("system-architecture.final.png")).toBe(
      "system architecture.final",
    );
    expect(toArticleImageAltText(".png")).toBe("文章图片");
  });
});
