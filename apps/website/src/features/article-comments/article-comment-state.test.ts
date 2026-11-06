import { describe, expect, it } from "vitest";
import type { ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";
import { appendComment, mergeRootComments } from "./article-comment-state";

describe("article comment state", () => {
  it("appends root comments to the end of the root list", () => {
    const first = createComment("first");
    const second = createComment("second");

    expect(appendComment([first], second)).toEqual([first, second]);
  });

  it("appends replies to the matching parent comment", () => {
    const root = createComment("root", null, [createComment("reply-1", "root")]);
    const reply = createComment("reply-2", "root");

    expect(appendComment([root], reply)[0]?.replies.map((comment) => comment.id)).toEqual([
      "reply-1",
      "reply-2",
    ]);
  });

  it("appends nested replies without changing unrelated branches", () => {
    const root = createComment("root", null, [
      createComment("reply-1", "root", [createComment("nested-1", "reply-1")]),
      createComment("reply-2", "root"),
    ]);
    const nestedReply = createComment("nested-2", "nested-1");

    const [updatedRoot] = appendComment([root], nestedReply);

    expect(updatedRoot?.replies[0]?.replies[0]?.replies.map((comment) => comment.id)).toEqual([
      "nested-2",
    ]);
    expect(updatedRoot?.replies[1]?.replies).toEqual([]);
  });

  it("merges only root comments that are not already loaded", () => {
    const first = createComment("first");
    const second = createComment("second");

    expect(mergeRootComments([first], [first, second])).toEqual([first, second]);
  });
});

function createComment(
  id: string,
  parentCommentId: string | null = null,
  replies: ArticleCommentResponse[] = [],
): ArticleCommentResponse {
  return {
    id,
    body: `${id} body`,
    parentCommentId,
    author: {
      id: `${id}-author`,
      login: `${id}-login`,
      name: null,
      avatarUrl: null,
      profileUrl: `https://github.com/${id}`,
    },
    replies,
    likeCount: 0,
    likedByMe: false,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
}
