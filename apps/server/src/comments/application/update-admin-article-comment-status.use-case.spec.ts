import { describe, expect, it, vi } from "vitest";
import type { AdminArticleCommentRepository } from "../domain/admin-article-comment.repository";
import {
  AdminArticleCommentNotFoundError,
  AdminArticleCommentValidationError,
} from "./admin-article-comment.errors";
import {
  UpdateAdminArticleCommentStatusUseCase,
  normalizeCommentStatus,
} from "./update-admin-article-comment-status.use-case";

describe("UpdateAdminArticleCommentStatusUseCase", () => {
  it("updates comment visibility status", async () => {
    const repository = createRepositoryDouble();
    const useCase = new UpdateAdminArticleCommentStatusUseCase(repository);

    await useCase.execute({
      id: "comment-1",
      status: "HIDDEN",
    });

    expect(repository.updateStatus).toHaveBeenCalledWith({
      id: "comment-1",
      status: "HIDDEN",
    });
  });

  it("throws when the comment does not exist", async () => {
    const repository = createRepositoryDouble();
    repository.updateStatus.mockResolvedValue(null);
    const useCase = new UpdateAdminArticleCommentStatusUseCase(repository);

    await expect(useCase.execute({ id: "missing", status: "VISIBLE" })).rejects.toBeInstanceOf(
      AdminArticleCommentNotFoundError,
    );
  });
});

describe("normalizeCommentStatus", () => {
  it("rejects unsupported statuses", () => {
    expect(() => normalizeCommentStatus("DELETED")).toThrow(AdminArticleCommentValidationError);
  });
});

function createRepositoryDouble() {
  return {
    list: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue({
      article: {
        id: "article-1",
        slug: "article",
        title: "Article",
      },
      author: {
        avatarUrl: null,
        id: "user-1",
        login: "adrian",
        name: "Adrian",
        profileUrl: "https://github.com/adrian",
      },
      body: "hello",
      createdAt: new Date("2026-07-03T00:00:00.000Z"),
      id: "comment-1",
      likeCount: 0,
      parent: null,
      parentCommentId: null,
      replyCount: 0,
      status: "HIDDEN",
      updatedAt: new Date("2026-07-03T00:00:00.000Z"),
    }),
  } as unknown as AdminArticleCommentRepository & {
    updateStatus: ReturnType<typeof vi.fn>;
  };
}
