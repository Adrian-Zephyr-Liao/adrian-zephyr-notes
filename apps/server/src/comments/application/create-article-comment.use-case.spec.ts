import { describe, expect, it, vi } from "vitest";
import type { ArticleCommentRepository } from "../domain/article-comment.repository";
import {
  ARTICLE_COMMENT_BODY_MAX_LENGTH,
  ArticleCommentBody,
  ArticleCommentBodyEmptyError,
  ArticleCommentBodyTooLongError,
} from "../domain/article-comment.entity";
import {
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentParentNotFoundError,
} from "./article-comment.errors";
import { CreateArticleCommentUseCase } from "./create-article-comment.use-case";

describe("CreateArticleCommentUseCase", () => {
  it("rejects comments that are empty after trimming", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        slug: "5f7448b7",
        body: "   ",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(ArticleCommentBodyEmptyError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.findPublicArticleIdBySlug).not.toHaveBeenCalled();
  });

  it("rejects comments that exceed the domain body length limit", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        slug: "5f7448b7",
        body: "a".repeat(ARTICLE_COMMENT_BODY_MAX_LENGTH + 1),
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(ArticleCommentBodyTooLongError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.findPublicArticleIdBySlug).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before creating comments", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        slug: "5f7448b7",
        body: "ship it",
        user: null,
      }),
    ).rejects.toBeInstanceOf(ArticleCommentAuthenticationRequiredError);
    expect(repository.findPublicArticleIdBySlug).not.toHaveBeenCalled();
  });

  it("creates replies under visible comments from the same article", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateArticleCommentUseCase(repository);

    await useCase.execute({
      slug: "5f7448b7",
      body: "  reply body  ",
      parentCommentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
    });

    expect(repository.create).toHaveBeenCalledWith({
      articleId: "0af1a8cb-44ee-4884-8268-3200336a4195",
      authorId: "7d569d22-8f0d-4283-b56c-786cc4770d0e",
      body: "reply body",
      parentCommentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
    });
  });

  it("rejects replies when the parent comment is not in the same article", async () => {
    const repository = createRepositoryDouble();
    repository.findVisibleCommentArticleIdById.mockResolvedValue(
      "5d388555-ee89-437b-a21d-f2f13c97d567",
    );
    const useCase = new CreateArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        slug: "5f7448b7",
        body: "reply body",
        parentCommentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(ArticleCommentParentNotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("ArticleCommentBody", () => {
  it("trims valid comment bodies", () => {
    expect(ArticleCommentBody.create("  ship it  ").toString()).toBe("ship it");
  });
});

function createRepositoryDouble() {
  return {
    create: vi.fn(),
    findVisibleCommentArticleIdById: vi
      .fn()
      .mockResolvedValue("0af1a8cb-44ee-4884-8268-3200336a4195"),
    findPublicArticleIdBySlug: vi.fn().mockResolvedValue("0af1a8cb-44ee-4884-8268-3200336a4195"),
    listVisibleByArticleId: vi.fn(),
  } as unknown as ArticleCommentRepository & {
    create: ReturnType<typeof vi.fn>;
    findVisibleCommentArticleIdById: ReturnType<typeof vi.fn>;
    findPublicArticleIdBySlug: ReturnType<typeof vi.fn>;
  };
}
