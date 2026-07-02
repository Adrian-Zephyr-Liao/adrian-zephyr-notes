import type { ArticleCommentAuthor, ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";

const MAX_RENDERED_REPLY_DEPTH = 2;

type ArticleCommentThreadItem = Omit<ArticleCommentResponse, "replies"> & {
  replies: ArticleCommentThreadItem[];
  replyContext: ArticleCommentAuthor | null;
};

function createArticleCommentThreads(
  comments: ArticleCommentResponse[],
  maxRenderedReplyDepth = MAX_RENDERED_REPLY_DEPTH,
): ArticleCommentThreadItem[] {
  return comments.flatMap((comment) =>
    createThreadItems({
      comment,
      depth: 0,
      maxRenderedReplyDepth,
      parentAuthor: null,
      isFlattened: false,
    }),
  );
}

function createThreadItems({
  comment,
  depth,
  maxRenderedReplyDepth,
  parentAuthor,
  isFlattened,
}: {
  comment: ArticleCommentResponse;
  depth: number;
  maxRenderedReplyDepth: number;
  parentAuthor: ArticleCommentAuthor | null;
  isFlattened: boolean;
}): ArticleCommentThreadItem[] {
  const canNestReplies = depth < maxRenderedReplyDepth;
  const item: ArticleCommentThreadItem = {
    ...comment,
    replyContext: isFlattened ? parentAuthor : null,
    replies: canNestReplies
      ? comment.replies.flatMap((reply) =>
          createThreadItems({
            comment: reply,
            depth: depth + 1,
            maxRenderedReplyDepth,
            parentAuthor: comment.author,
            isFlattened: false,
          }),
        )
      : [],
  };

  if (canNestReplies) {
    return [item];
  }

  return [
    item,
    ...comment.replies.flatMap((reply) =>
      createThreadItems({
        comment: reply,
        depth,
        maxRenderedReplyDepth,
        parentAuthor: comment.author,
        isFlattened: true,
      }),
    ),
  ];
}

export { MAX_RENDERED_REPLY_DEPTH, createArticleCommentThreads };
export type { ArticleCommentThreadItem };
