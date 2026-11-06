// @vitest-environment jsdom

import type { ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleCommentList } from "./article-comment-list";
import { createArticleCommentThreads } from "./article-comment-thread";

afterEach(cleanup);

describe("article comment like button names", () => {
  it("includes the visible count and preserves the person, action and current pressed state", () => {
    const onToggleLike = vi.fn();
    const props = {
      canLoadMore: false,
      expandedCommentIds: new Set<string>(),
      initialLoadState: "ready" as const,
      loadErrorMessage: null,
      onRetry: vi.fn(),
      isLoadingMore: false,
      likingCommentIds: new Set<string>(),
      isSubmitting: false,
      onLoadMore: vi.fn(),
      onReply: vi.fn(),
      onToggleLike,
      onToggleReplies: vi.fn(),
    };
    const comment: ArticleCommentResponse = {
      id: "comment",
      body: "A response to the article",
      parentCommentId: null,
      author: {
        id: "visitor",
        login: "visitor",
        name: "Visitor",
        avatarUrl: null,
        profileUrl: "https://example.test/visitor",
      },
      replies: [],
      likeCount: 0,
      likedByMe: false,
      createdAt: "2026-11-06T12:00:00.000Z",
      updatedAt: "2026-11-06T12:00:00.000Z",
    };
    const page = render(
      <ArticleCommentList {...props} commentThreads={createArticleCommentThreads([comment])} />,
    );
    const like = screen.getByRole("button", { name: "给 Visitor 的评论点赞，当前 0 个赞" });
    expect(like.textContent).toBe("0");
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    expect(onToggleLike).toHaveBeenCalledWith(
      expect.objectContaining({ id: comment.id, likedByMe: false }),
    );

    const liked = { ...comment, likeCount: 12, likedByMe: true };
    page.rerender(
      <ArticleCommentList {...props} commentThreads={createArticleCommentThreads([liked])} />,
    );
    const unlike = screen.getByRole("button", { name: "取消给 Visitor 的评论点赞，当前 12 个赞" });
    expect(unlike.textContent).toBe("12");
    expect(unlike.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(unlike);
    expect(onToggleLike).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: comment.id, likedByMe: true }),
    );

    page.rerender(
      <ArticleCommentList
        {...props}
        likingCommentIds={new Set([comment.id])}
        commentThreads={createArticleCommentThreads([liked])}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "取消给 Visitor 的评论点赞，当前 12 个赞",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
