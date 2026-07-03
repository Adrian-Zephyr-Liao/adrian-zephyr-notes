import { describe, expect, it, vi } from "vitest";
import type { AdminArticleRepository } from "../domain/admin-article.repository";
import {
  ListAdminArticlesUseCase,
  normalizeListAdminArticlesInput,
} from "./list-admin-articles.use-case";

describe("ListAdminArticlesUseCase", () => {
  it("normalizes filters before querying the admin article repository", async () => {
    const repository = createRepositoryDouble();
    const useCase = new ListAdminArticlesUseCase(repository);

    await useCase.execute({
      page: 0,
      pageSize: 500,
      search: "  markdown  ",
      status: "PUBLISHED",
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "markdown",
      status: "PUBLISHED",
    });
  });
});

describe("normalizeListAdminArticlesInput", () => {
  it("drops unsupported status filters", () => {
    expect(
      normalizeListAdminArticlesInput({
        status: "ALL",
      }),
    ).toEqual({
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
  } as unknown as AdminArticleRepository & {
    list: ReturnType<typeof vi.fn>;
  };
}
