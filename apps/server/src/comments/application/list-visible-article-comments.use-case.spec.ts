import { describe, expect, it, vi } from "vitest";
import type { ArticleCommentRepository } from "../domain/article-comment.repository";
import { normalizeArticleCommentsQuery } from "./article-comments-pagination";
import { ListVisibleArticleCommentsUseCase } from "./list-visible-article-comments.use-case";

describe("ListVisibleArticleCommentsUseCase", () => {
  it("uses bounded pagination when listing visible comments", async () => {
    const repository = createRepositoryDouble();
    const useCase = new ListVisibleArticleCommentsUseCase(repository);

    const result = await useCase.execute("5f7448b7", {
      page: 2,
      pageSize: 5,
    });

    expect(repository.listVisibleByArticleId).toHaveBeenCalledWith(
      "0af1a8cb-44ee-4884-8268-3200336a4195",
      {
        page: 2,
        pageSize: 5,
        viewerUserId: undefined,
      },
    );
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 5,
      totalItems: 23,
      totalPages: 5,
    });
  });
});

describe("comment pagination", () => {
  it("normalizes comment pagination defaults and maximums", () => {
    expect(normalizeArticleCommentsQuery({ page: -5, pageSize: 500 })).toEqual({
      page: 1,
      pageSize: 50,
    });
    expect(normalizeArticleCommentsQuery({})).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});

function createRepositoryDouble() {
  return {
    create: vi.fn(),
    findVisibleCommentArticleIdById: vi.fn(),
    findPublicArticleIdBySlug: vi.fn().mockResolvedValue("0af1a8cb-44ee-4884-8268-3200336a4195"),
    listVisibleByArticleId: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        page: 2,
        pageSize: 5,
        totalItems: 23,
        totalPages: 5,
      },
    }),
  } as unknown as ArticleCommentRepository & {
    listVisibleByArticleId: ReturnType<typeof vi.fn>;
  };
}
