import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../database/prisma.service";
import { PrismaArticleCommentRepository } from "./prisma-article-comment.repository";
import type { ArticleCommentRecord } from "./article-comments.mapper";

describe("PrismaArticleCommentRepository", () => {
  it("loads descendants only for the current page root comments", async () => {
    const rootComments = [createCommentRecord("root-1", null), createCommentRecord("root-2", null)];
    const reply = createCommentRecord("reply-1", "root-1");
    const nestedReply = createCommentRecord("nested-1", "reply-1");
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(rootComments)
      .mockResolvedValueOnce([reply])
      .mockResolvedValueOnce([nestedReply])
      .mockResolvedValueOnce([]);
    const count = vi.fn().mockResolvedValue(2);
    const repository = new PrismaArticleCommentRepository(createPrismaDouble({ count, findMany }));

    const result = await repository.listVisibleByArticleId("article-1", {
      page: 1,
      pageSize: 2,
    });

    expect(result.data[0]?.replies[0]?.id).toBe("reply-1");
    expect(result.data[0]?.replies[0]?.replies[0]?.id).toBe("nested-1");
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          articleId: "article-1",
          parentCommentId: {
            in: ["root-1", "root-2"],
          },
          status: "VISIBLE",
        }),
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          parentCommentId: {
            in: ["reply-1"],
          },
        }),
      }),
    );
    expect(findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentCommentId: {
            not: null,
          },
        }),
      }),
    );
  });
});

function createPrismaDouble({
  count,
  findMany,
}: {
  count: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
}) {
  return {
    articleComment: {
      count,
      findMany,
    },
    $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
  } as unknown as PrismaService;
}

function createCommentRecord(id: string, parentCommentId: string | null): ArticleCommentRecord {
  const now = new Date("2026-07-02T00:00:00.000Z");

  return {
    id,
    articleId: "article-1",
    authorId: `${id}-author`,
    body: `${id} body`,
    parentCommentId,
    status: "VISIBLE",
    createdAt: now,
    updatedAt: now,
    author: {
      id: `${id}-author`,
      githubId: `${id}-github`,
      login: `${id}-login`,
      name: null,
      avatarUrl: null,
      profileUrl: `https://github.com/${id}`,
      createdAt: now,
      updatedAt: now,
    },
  } as ArticleCommentRecord;
}
