import { describe, expect, it, vi } from "vitest";
import type { AdminArticleCommentRepository } from "../domain/admin-article-comment.repository";
import {
  ListAdminArticleCommentsUseCase,
  normalizeListAdminArticleCommentsInput,
} from "./list-admin-article-comments.use-case";

describe("ListAdminArticleCommentsUseCase", () => {
  it("normalizes filters before querying comments", async () => {
    const repository = createRepositoryDouble();
    const useCase = new ListAdminArticleCommentsUseCase(repository);

    await useCase.execute({
      commentId: "  comment-1  ",
      page: 0,
      pageSize: 500,
      search: "  hello  ",
      status: "HIDDEN",
    });

    expect(repository.list).toHaveBeenCalledWith({
      commentId: "comment-1",
      page: 1,
      pageSize: 50,
      search: "hello",
      status: "HIDDEN",
    });
  });
});

describe("normalizeListAdminArticleCommentsInput", () => {
  it("drops unsupported status filters", () => {
    expect(normalizeListAdminArticleCommentsInput({ status: "ALL" })).toEqual({
      commentId: undefined,
      page: 1,
      pageSize: 20,
      search: undefined,
      status: undefined,
    });
  });
});

function createRepositoryDouble() {
  return {
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    }),
    updateStatus: vi.fn(),
  } as unknown as AdminArticleCommentRepository & {
    list: ReturnType<typeof vi.fn>;
  };
}
