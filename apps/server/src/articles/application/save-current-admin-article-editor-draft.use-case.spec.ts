import { describe, expect, it, vi } from "vitest";
import type { AdminArticleRepository } from "../domain/admin-article.repository";
import type { AdminArticleEditorDraftRepository } from "../domain/admin-article-editor-draft.repository";
import { AdminArticleNotFoundError, AdminArticleValidationError } from "./admin-article.errors";
import { SaveCurrentAdminArticleEditorDraftUseCase } from "./save-current-admin-article-editor-draft.use-case";

describe("SaveCurrentAdminArticleEditorDraftUseCase", () => {
  it("saves a new article draft without requiring an article record", async () => {
    const draftRepository = createDraftRepositoryDouble();
    const articleRepository = createArticleRepositoryDouble();
    const useCase = new SaveCurrentAdminArticleEditorDraftUseCase(
      draftRepository,
      articleRepository,
    );

    await useCase.execute({
      ownerUserId: "admin-1",
      articleId: null,
      clientSavedAt: "2026-07-03T10:00:00.000Z",
      values: {
        title: "New draft",
        description: "",
        markdown: "# Draft",
        status: "DRAFT",
        origin: "REPOSTED",
        sourceAuthor: "Original Author",
        sourceName: "Source Site",
        sourceUrl: "https://example.com/original",
        categorySlug: "",
        tagSlugs: [],
        coverImageUrl: "",
      },
    });

    expect(articleRepository.findById).not.toHaveBeenCalled();
    expect(draftRepository.saveCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "admin-1",
        articleId: null,
      }),
    );
  });

  it("rejects article-scoped drafts when the article no longer exists", async () => {
    const draftRepository = createDraftRepositoryDouble();
    const articleRepository = createArticleRepositoryDouble(null);
    const useCase = new SaveCurrentAdminArticleEditorDraftUseCase(
      draftRepository,
      articleRepository,
    );

    await expect(
      useCase.execute({
        ownerUserId: "admin-1",
        articleId: "article-1",
        clientSavedAt: "2026-07-03T10:00:00.000Z",
        values: {
          title: "Existing article",
          description: "",
          markdown: "# Draft",
          status: "DRAFT",
          origin: "ORIGINAL",
          sourceAuthor: "",
          sourceName: "",
          sourceUrl: "",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
        },
      }),
    ).rejects.toBeInstanceOf(AdminArticleNotFoundError);
    expect(draftRepository.saveCurrent).not.toHaveBeenCalled();
  });

  it("rejects stale taxonomy slugs before saving a draft", async () => {
    const draftRepository = createDraftRepositoryDouble();
    const articleRepository = createArticleRepositoryDouble();
    const useCase = new SaveCurrentAdminArticleEditorDraftUseCase(
      draftRepository,
      articleRepository,
    );

    await expect(
      useCase.execute({
        ownerUserId: "admin-1",
        articleId: null,
        clientSavedAt: "2026-07-03T10:00:00.000Z",
        values: {
          title: "Stale draft",
          description: "",
          markdown: "# Draft",
          status: "DRAFT",
          origin: "ORIGINAL",
          sourceAuthor: "",
          sourceName: "",
          sourceUrl: "",
          categorySlug: "removed-category",
          tagSlugs: ["removed-tag"],
          coverImageUrl: "",
        },
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(draftRepository.saveCurrent).not.toHaveBeenCalled();
  });
});

function createDraftRepositoryDouble() {
  return {
    deleteCurrent: vi.fn(),
    findCurrent: vi.fn(),
    saveCurrent: vi.fn(async (input) => ({
      id: "draft-1",
      ownerUserId: input.ownerUserId,
      articleId: input.articleId,
      baseArticleUpdatedAt: input.baseArticleUpdatedAt,
      savedAt: new Date("2026-07-03T10:00:00.000Z"),
      values: input.values,
    })),
  } satisfies AdminArticleEditorDraftRepository;
}

function createArticleRepositoryDouble(article: unknown = { id: "article-1" }) {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn().mockResolvedValue(article),
    list: vi.fn(),
    listTaxonomyOptions: vi.fn().mockResolvedValue({ categories: [], tags: [] }),
    update: vi.fn(),
  } as unknown as AdminArticleRepository & {
    findById: ReturnType<typeof vi.fn>;
    listTaxonomyOptions: ReturnType<typeof vi.fn>;
  };
}
