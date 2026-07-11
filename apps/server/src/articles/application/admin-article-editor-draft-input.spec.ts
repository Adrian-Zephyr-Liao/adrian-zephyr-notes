import { describe, expect, it } from "vitest";
import { AdminArticleValidationError } from "./admin-article.errors";
import { normalizeSaveAdminArticleEditorDraftInput } from "./admin-article-editor-draft-input";

describe("normalizeSaveAdminArticleEditorDraftInput", () => {
  it("normalizes article draft values without requiring publish-ready content", () => {
    const input = normalizeSaveAdminArticleEditorDraftInput({
      ownerUserId: " owner-1 ",
      articleId: " article-1 ",
      baseArticleUpdatedAt: "2026-07-03T10:00:00.000Z",
      clientSavedAt: "2026-07-03T10:01:00.000Z",
      values: {
        title: "  ",
        description: "  ",
        markdown: "",
        status: "DRAFT",
        categorySlug: " notes ",
        tagSlugs: [" markdown ", "markdown", ""],
        coverImageUrl: " https://example.test/cover.png ",
      },
    });

    expect(input).toEqual({
      ownerUserId: "owner-1",
      articleId: "article-1",
      baseArticleUpdatedAt: new Date("2026-07-03T10:00:00.000Z"),
      clientSavedAt: new Date("2026-07-03T10:01:00.000Z"),
      values: {
        title: "",
        description: "",
        markdown: "",
        status: "DRAFT",
        categorySlug: "notes",
        tagSlugs: ["markdown"],
        coverImageUrl: "https://example.test/cover.png",
        origin: "ORIGINAL",
        sourceAuthor: "",
        sourceName: "",
        sourceUrl: "",
      },
    });
  });

  it("uses the shared new-draft scope inputs when article id is empty", () => {
    const input = normalizeSaveAdminArticleEditorDraftInput({
      ownerUserId: "owner-1",
      articleId: " ",
      clientSavedAt: "2026-07-03T10:01:00.000Z",
      values: {
        title: "New",
        description: "",
        markdown: "# Draft",
        status: "DRAFT",
        categorySlug: "",
        tagSlugs: [],
        coverImageUrl: "",
      },
    });

    expect(input.articleId).toBeNull();
  });

  it("rejects unsupported status and invalid dates", () => {
    expect(() =>
      normalizeSaveAdminArticleEditorDraftInput({
        ownerUserId: "owner-1",
        baseArticleUpdatedAt: "not-a-date",
        clientSavedAt: "2026-07-03T10:01:00.000Z",
        values: {
          title: "New",
          description: "",
          markdown: "# Draft",
          status: "DRAFT",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
        },
      }),
    ).toThrow(AdminArticleValidationError);

    expect(() =>
      normalizeSaveAdminArticleEditorDraftInput({
        ownerUserId: "owner-1",
        clientSavedAt: "not-a-date",
        values: {
          title: "New",
          description: "",
          markdown: "# Draft",
          status: "DRAFT",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
        },
      }),
    ).toThrow(AdminArticleValidationError);

    expect(() =>
      normalizeSaveAdminArticleEditorDraftInput({
        ownerUserId: "owner-1",
        values: {
          title: "New",
          description: "",
          markdown: "# Draft",
          status: "DRAFT",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
        },
      } as unknown as Parameters<typeof normalizeSaveAdminArticleEditorDraftInput>[0]),
    ).toThrow(AdminArticleValidationError);

    expect(() =>
      normalizeSaveAdminArticleEditorDraftInput({
        ownerUserId: "owner-1",
        clientSavedAt: "2026-07-03T10:01:00.000Z",
        values: {
          title: "New",
          description: "",
          markdown: "# Draft",
          status: "UNKNOWN",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
        },
      }),
    ).toThrow(AdminArticleValidationError);
  });
});
