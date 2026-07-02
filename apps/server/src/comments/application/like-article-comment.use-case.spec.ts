import { describe, expect, it, vi } from "vitest";
import type { ArticleCommentLikeRepository } from "../domain/article-comment-like.repository";
import {
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentLikeTargetNotFoundError,
} from "./article-comment.errors";
import { LikeArticleCommentUseCase } from "./like-article-comment.use-case";
import { UnlikeArticleCommentUseCase } from "./unlike-article-comment.use-case";

describe("LikeArticleCommentUseCase", () => {
  it("requires an authenticated user before liking comments", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new LikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: null,
      }),
    ).rejects.toBeInstanceOf(ArticleCommentAuthenticationRequiredError);
    expect(repository.likeVisibleComment).not.toHaveBeenCalled();
  });

  it("returns the current like state after liking a visible comment", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new LikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).resolves.toEqual({
      commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 12,
      likedByMe: true,
    });
  });

  it("rejects liking comments that are not visible", async () => {
    const repository = createLikeRepositoryDouble();
    repository.likeVisibleComment.mockResolvedValue(null);
    const useCase = new LikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(ArticleCommentLikeTargetNotFoundError);
  });
});

describe("UnlikeArticleCommentUseCase", () => {
  it("requires an authenticated user before unliking comments", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new UnlikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: null,
      }),
    ).rejects.toBeInstanceOf(ArticleCommentAuthenticationRequiredError);
    expect(repository.unlikeVisibleComment).not.toHaveBeenCalled();
  });

  it("returns the current like state after unliking a visible comment", async () => {
    const repository = createLikeRepositoryDouble();
    const useCase = new UnlikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).resolves.toEqual({
      commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 11,
      likedByMe: false,
    });
  });

  it("rejects unliking comments that are not visible", async () => {
    const repository = createLikeRepositoryDouble();
    repository.unlikeVisibleComment.mockResolvedValue(null);
    const useCase = new UnlikeArticleCommentUseCase(repository);

    await expect(
      useCase.execute({
        commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
        user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
      }),
    ).rejects.toBeInstanceOf(ArticleCommentLikeTargetNotFoundError);
  });
});

function createLikeRepositoryDouble() {
  return {
    likeVisibleComment: vi.fn().mockResolvedValue({
      commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 12,
      likedByMe: true,
    }),
    unlikeVisibleComment: vi.fn().mockResolvedValue({
      commentId: "5d1e70e9-6bbb-4ed4-a7cb-81d1c63dcf95",
      likeCount: 11,
      likedByMe: false,
    }),
  } as unknown as ArticleCommentLikeRepository & {
    likeVisibleComment: ReturnType<typeof vi.fn>;
    unlikeVisibleComment: ReturnType<typeof vi.fn>;
  };
}
