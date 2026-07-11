import { describe, expect, it, vi } from "vitest";
import type {
  AdminArticleDetail,
  AdminArticleRepository,
  ListAdminArticlesFilters,
  UpdateAdminArticleRepositoryInput,
} from "../domain/admin-article.repository";
import { AdminArticleValidationError } from "./admin-article.errors";
import type { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";
import { UpdateAdminArticleUseCase } from "./update-admin-article.use-case";

describe("UpdateAdminArticleUseCase", () => {
  it("sets publishedAt when publishing a draft article", async () => {
    const now = new Date("2026-07-03T00:00:00.000Z");
    const repository = createRepositoryDouble({
      ...createArticle(),
      status: "DRAFT",
      publishedAt: null,
    });
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await useCase.execute({ id: "article-1", status: "PUBLISHED" }, now);

    expect(repository.update).toHaveBeenCalledWith({
      id: "article-1",
      publishedAt: now,
      status: "PUBLISHED",
    });
  });

  it("queues AI summary again after summary content changes", async () => {
    const repository = createRepositoryDouble(createArticle());
    const queue = createQueueDouble();
    const useCase = new UpdateAdminArticleUseCase(repository, queue);

    await useCase.execute({
      id: "article-1",
      markdown: "# Updated Markdown",
    });

    expect(queue.execute).toHaveBeenCalledWith({
      articleId: "article-1",
      description: "Original description",
      markdown: "# Updated Markdown",
      title: "Original title",
    });
  });

  it("allows draft updates without a description", async () => {
    const repository = createRepositoryDouble(
      createArticle({
        description: "",
        status: "DRAFT",
      }),
    );
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await useCase.execute({
      id: "article-1",
      description: "   ",
      status: "DRAFT",
    });

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "",
        status: "DRAFT",
      }),
    );
  });

  it("rejects publishing without a description", async () => {
    const repository = createRepositoryDouble(
      createArticle({
        description: "",
        status: "DRAFT",
      }),
    );
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        id: "article-1",
        status: "PUBLISHED",
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects unknown category slugs before updating", async () => {
    const repository = createRepositoryDouble(createArticle());
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        id: "article-1",
        categorySlug: "missing",
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects unknown tag slugs before updating", async () => {
    const repository = createRepositoryDouble(createArticle());
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        id: "article-1",
        tagSlugs: ["markdown", "missing"],
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("clears repost attribution when switching back to original", async () => {
    const repository = createRepositoryDouble(
      createArticle({
        origin: "REPOSTED",
        source: {
          author: "Original Author",
          name: "Source Site",
          url: "https://example.com/original",
        },
      }),
    );
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await useCase.execute({ id: "article-1", origin: "ORIGINAL" });

    expect(repository.update).toHaveBeenCalledWith({
      id: "article-1",
      origin: "ORIGINAL",
      sourceAuthor: null,
      sourceName: null,
      sourceUrl: null,
    });
  });

  it("rejects publishing a repost draft without a valid source url", async () => {
    const repository = createRepositoryDouble(
      createArticle({
        origin: "REPOSTED",
        source: null,
        status: "DRAFT",
        publishedAt: null,
      }),
    );
    const useCase = new UpdateAdminArticleUseCase(repository, createQueueDouble());

    await expect(useCase.execute({ id: "article-1", status: "PUBLISHED" })).rejects.toBeInstanceOf(
      AdminArticleValidationError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});

function createRepositoryDouble(article: AdminArticleDetail) {
  const repository = {
    findById: vi.fn().mockResolvedValue(article),
    list: vi.fn(async (_filters: ListAdminArticlesFilters) => ({
      data: [article],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    })),
    listTaxonomyOptions: vi.fn().mockResolvedValue({
      categories: [{ slug: "notes", name: "笔记" }],
      tags: [{ slug: "markdown", name: "Markdown" }],
    }),
    update: vi.fn(async (input: UpdateAdminArticleRepositoryInput) => ({
      ...article,
      ...input,
      category:
        input.categorySlug === undefined
          ? article.category
          : input.categorySlug
            ? { slug: input.categorySlug, name: input.categorySlug }
            : null,
      tags:
        input.tagSlugs === undefined
          ? article.tags
          : input.tagSlugs.map((slug) => ({ slug, name: slug })),
      updatedAt: new Date("2026-07-03T00:00:00.000Z"),
    })),
  };

  return repository as unknown as AdminArticleRepository & {
    update: ReturnType<typeof vi.fn>;
  };
}

function createQueueDouble() {
  return {
    execute: vi.fn().mockResolvedValue("QUEUED"),
  } as unknown as QueueArticleSummaryUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createArticle(overrides: Partial<AdminArticleDetail> = {}): AdminArticleDetail {
  return {
    aiSummaryStatus: "READY",
    category: {
      name: "笔记",
      slug: "notes",
    },
    commentCount: 0,
    coverImageUrl: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    description: "Original description",
    id: "article-1",
    markdown: "# Original Markdown",
    origin: "ORIGINAL",
    publishedAt: new Date("2026-07-02T00:00:00.000Z"),
    readingMinutes: 1,
    slug: "article-slug",
    status: "PUBLISHED",
    source: null,
    tags: [{ slug: "markdown", name: "Markdown" }],
    title: "Original title",
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    wordCount: 10,
    ...overrides,
  };
}
