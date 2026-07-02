import { describe, expect, it } from "vitest";
import type { ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";
import { createArticleCommentThreads } from "./article-comment-thread";

describe("createArticleCommentThreads", () => {
  it("keeps replies at the maximum rendered depth instead of nesting forever", () => {
    const [thread] = createArticleCommentThreads([
      createComment("root", "adrian", [
        createComment("level-1", "mira", [
          createComment("level-2", "noah", [
            createComment("level-3", "iris", [createComment("level-4", "kai")]),
          ]),
        ]),
      ]),
    ]);

    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0]?.id).toBe("level-1");
    expect(thread.replies[0]?.replies.map((comment) => comment.id)).toEqual([
      "level-2",
      "level-3",
      "level-4",
    ]);
    expect(thread.replies[0]?.replies[0]?.replies).toEqual([]);
    expect(thread.replies[0]?.replies[1]?.replyContext?.login).toBe("noah");
    expect(thread.replies[0]?.replies[2]?.replyContext?.login).toBe("iris");
  });

  it("does not add reply context to normally nested replies", () => {
    const [thread] = createArticleCommentThreads([
      createComment("root", "adrian", [createComment("level-1", "mira")]),
    ]);

    expect(thread.replyContext).toBeNull();
    expect(thread.replies[0]?.replyContext).toBeNull();
  });
});

function createComment(
  id: string,
  login: string,
  replies: ArticleCommentResponse[] = [],
): ArticleCommentResponse {
  return {
    id,
    body: `${id} body`,
    parentCommentId: id === "root" ? null : "parent-id",
    author: {
      id: `${id}-author`,
      login,
      name: null,
      avatarUrl: null,
      profileUrl: `https://github.com/${login}`,
    },
    replies,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
}
