import { describe, expect, it } from "vitest";
import type { ArticleEditorValues } from "./article-editor";
import {
  getArticleEditorValidationMessage,
  toArticleMutationPayload,
} from "./article-editor-model";

describe("article editor origin model", () => {
  it("includes normalized repost attribution in article mutations", () => {
    expect(
      toArticleMutationPayload(
        createValues({
          origin: "REPOSTED",
          sourceAuthor: "  Original Author  ",
          sourceName: "  Source Site  ",
          sourceUrl: "  https://example.com/original  ",
        }),
      ),
    ).toMatchObject({
      origin: "REPOSTED",
      sourceAuthor: "Original Author",
      sourceName: "Source Site",
      sourceUrl: "https://example.com/original",
    });
  });

  it("requires complete attribution before publishing a repost", () => {
    expect(
      getArticleEditorValidationMessage(
        createValues({ origin: "REPOSTED", sourceName: "Source Site", sourceUrl: "" }),
      ),
    ).toBe("发布转载文章前需要填写来源名称和有效的原文链接。");
  });
});

function createValues(overrides: Record<string, unknown> = {}) {
  return {
    categorySlug: "",
    coverImageUrl: "",
    description: "Description",
    markdown: "# Markdown",
    origin: "ORIGINAL",
    sourceAuthor: "",
    sourceName: "",
    sourceUrl: "",
    status: "PUBLISHED",
    tagSlugs: [],
    title: "Title",
    ...overrides,
  } as ArticleEditorValues;
}
