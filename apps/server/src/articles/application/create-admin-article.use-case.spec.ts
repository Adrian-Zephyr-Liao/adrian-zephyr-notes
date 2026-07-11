import { describe, expect, it, vi } from "vitest";
import type {
  AdminArticleDetail,
  AdminArticleRepository,
  CreateAdminArticleRepositoryInput,
} from "../domain/admin-article.repository";
import { AdminArticleValidationError } from "./admin-article.errors";
import { CreateAdminArticleUseCase } from "./create-admin-article.use-case";
import type { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

describe("CreateAdminArticleUseCase", () => {
  it("creates a draft article with a short slug and queues AI summary", async () => {
    const repository = createRepositoryDouble();
    const queue = createQueueDouble();
    const useCase = new CreateAdminArticleUseCase(repository, queue);

    const article = await useCase.execute({
      title: "  New Article  ",
      description: "  Useful description  ",
      markdown: "# Hello\n\ncontent",
      tagSlugs: ["markdown", "markdown"],
    });

    expect(article.slug).toMatch(/^[a-z0-9]{8}$/);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Useful description",
        status: "DRAFT",
        tagSlugs: ["markdown"],
        title: "New Article",
      }),
    );
    expect(queue.execute).toHaveBeenCalledWith({
      articleId: "created-article",
      description: "Useful description",
      markdown: "# Hello\n\ncontent",
      title: "New Article",
    });
  });

  it("rejects unknown taxonomy before creating", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        title: "New Article",
        description: "Useful description",
        markdown: "# Hello",
        categorySlug: "missing",
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("allows draft articles without a description", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await useCase.execute({
      title: "Draft Article",
      description: "   ",
      markdown: "# Draft",
      status: "DRAFT",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "",
        status: "DRAFT",
      }),
    );
  });

  it("requires a description before publishing", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        title: "Published Article",
        description: "   ",
        markdown: "# Published",
        status: "PUBLISHED",
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("normalizes repost attribution before publishing", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await useCase.execute({
      title: "Reposted Article",
      description: "Useful description",
      markdown: "# Reposted",
      origin: "REPOSTED",
      sourceAuthor: "  Original Author  ",
      sourceName: "  Source Site  ",
      sourceUrl: "  https://example.com/original  ",
      status: "PUBLISHED",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "REPOSTED",
        sourceAuthor: "Original Author",
        sourceName: "Source Site",
        sourceUrl: "https://example.com/original",
      }),
    );
  });

  it("rejects repost publication without complete attribution", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        title: "Reposted Article",
        description: "Useful description",
        markdown: "# Reposted",
        origin: "REPOSTED",
        sourceName: "Source Site",
        sourceUrl: "",
        status: "PUBLISHED",
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects more than five article tags", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateAdminArticleUseCase(repository, createQueueDouble());

    await expect(
      useCase.execute({
        title: "Tagged Article",
        description: "Useful description",
        markdown: "# Tagged",
        tagSlugs: ["one", "two", "three", "four", "five", "six"],
      }),
    ).rejects.toBeInstanceOf(AdminArticleValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

function createRepositoryDouble() {
  const repository = {
    create: vi.fn(async (input: CreateAdminArticleRepositoryInput) => createArticle(input)),
    delete: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    listTaxonomyOptions: vi.fn().mockResolvedValue({
      categories: [{ slug: "notes", name: "笔记" }],
      tags: [{ slug: "markdown", name: "Markdown" }],
    }),
    update: vi.fn(),
  };

  return repository as unknown as AdminArticleRepository & {
    create: ReturnType<typeof vi.fn>;
  };
}

function createQueueDouble() {
  return {
    execute: vi.fn().mockResolvedValue("QUEUED"),
  } as unknown as QueueArticleSummaryUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createArticle(input: CreateAdminArticleRepositoryInput): AdminArticleDetail {
  return {
    aiSummaryStatus: "PENDING",
    category: null,
    commentCount: 0,
    coverImageUrl: input.coverImageUrl,
    createdAt: new Date("2026-07-03T00:00:00.000Z"),
    description: input.description,
    id: "created-article",
    markdown: input.markdown,
    origin: input.origin,
    publishedAt: input.publishedAt,
    readingMinutes: input.readingMinutes,
    slug: input.slug,
    status: input.status,
    source: input.sourceUrl
      ? {
          author: input.sourceAuthor,
          name: input.sourceName ?? "",
          url: input.sourceUrl,
        }
      : null,
    tags: input.tagSlugs.map((slug) => ({ slug, name: slug })),
    title: input.title,
    updatedAt: new Date("2026-07-03T00:00:00.000Z"),
    wordCount: input.wordCount,
  };
}
