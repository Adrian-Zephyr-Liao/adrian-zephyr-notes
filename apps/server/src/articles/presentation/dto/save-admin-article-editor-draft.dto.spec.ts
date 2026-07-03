import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { SaveAdminArticleEditorDraftDto } from "./save-admin-article-editor-draft.dto";

describe("SaveAdminArticleEditorDraftDto", () => {
  it("rejects requests without draft values", async () => {
    const dto = plainToInstance(SaveAdminArticleEditorDraftDto, {
      articleId: null,
      clientSavedAt: "2026-07-03T10:00:00.000Z",
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "values",
        }),
      ]),
    );
  });

  it("rejects requests without a client save timestamp", async () => {
    const dto = plainToInstance(SaveAdminArticleEditorDraftDto, {
      articleId: null,
      values: {
        title: "",
        description: "",
        markdown: "",
        status: "DRAFT",
        categorySlug: "",
        tagSlugs: [],
        coverImageUrl: "",
      },
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "clientSavedAt",
        }),
      ]),
    );
  });

  it("accepts complete draft values", async () => {
    const dto = plainToInstance(SaveAdminArticleEditorDraftDto, {
      articleId: null,
      clientSavedAt: "2026-07-03T10:00:00.000Z",
      values: {
        title: "",
        description: "",
        markdown: "",
        status: "DRAFT",
        categorySlug: "",
        tagSlugs: [],
        coverImageUrl: "",
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
