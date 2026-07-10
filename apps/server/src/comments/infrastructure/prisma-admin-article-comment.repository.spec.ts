import { describe, expect, it } from "vitest";
import { buildAdminArticleCommentWhere } from "./prisma-admin-article-comment.repository";

describe("buildAdminArticleCommentWhere", () => {
  it("filters directly by comment id for Agent Home deep links", () => {
    expect(
      buildAdminArticleCommentWhere({
        commentId: "comment-1",
        page: 1,
        pageSize: 10,
      }),
    ).toEqual({
      id: "comment-1",
    });
  });

  it("combines comment id with existing admin filters", () => {
    expect(
      buildAdminArticleCommentWhere({
        commentId: "comment-1",
        page: 1,
        pageSize: 10,
        search: "spam",
        status: "HIDDEN",
      }),
    ).toEqual({
      id: "comment-1",
      OR: [
        { body: { contains: "spam", mode: "insensitive" } },
        { author: { login: { contains: "spam", mode: "insensitive" } } },
        { author: { name: { contains: "spam", mode: "insensitive" } } },
        { article: { title: { contains: "spam", mode: "insensitive" } } },
        { article: { slug: { contains: "spam", mode: "insensitive" } } },
      ],
      status: "HIDDEN",
    });
  });
});
