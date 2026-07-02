import type { ArticleCommentAuthor, ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";

const MAX_RENDERED_REPLY_DEPTH = 2;
const DEFAULT_VISIBLE_REPLY_COUNT = 2;

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

function getVisibleCommentReplies(
  comment: ArticleCommentThreadItem,
  isExpanded: boolean,
  visibleReplyCount = DEFAULT_VISIBLE_REPLY_COUNT,
) {
  const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, visibleReplyCount);

  return {
    visibleReplies,
    hiddenReplyCount: Math.max(comment.replies.length - visibleReplies.length, 0),
    canToggleReplies: comment.replies.length > visibleReplyCount,
  };
}

function findReplyExpansionTargetId(
  comments: ArticleCommentResponse[],
  parentCommentId: string,
  maxRenderedReplyDepth = MAX_RENDERED_REPLY_DEPTH,
) {
  return findReplyExpansionTarget({
    comments,
    depth: 0,
    maxRenderedReplyDepth,
    parentCommentId,
    ancestors: [],
  });
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

function findReplyExpansionTarget({
  comments,
  depth,
  maxRenderedReplyDepth,
  parentCommentId,
  ancestors,
}: {
  comments: ArticleCommentResponse[];
  depth: number;
  maxRenderedReplyDepth: number;
  parentCommentId: string;
  ancestors: ArticleCommentResponse[];
}): string | null {
  for (const comment of comments) {
    const nextAncestors = [...ancestors, comment];

    if (comment.id === parentCommentId) {
      const expansionTargetDepth = Math.min(depth, Math.max(maxRenderedReplyDepth - 1, 0));
      return nextAncestors[expansionTargetDepth]?.id ?? comment.id;
    }

    const childTargetId = findReplyExpansionTarget({
      comments: comment.replies,
      depth: depth + 1,
      maxRenderedReplyDepth,
      parentCommentId,
      ancestors: nextAncestors,
    });

    if (childTargetId) {
      return childTargetId;
    }
  }

  return null;
}

export {
  DEFAULT_VISIBLE_REPLY_COUNT,
  MAX_RENDERED_REPLY_DEPTH,
  createArticleCommentThreads,
  findReplyExpansionTargetId,
  getVisibleCommentReplies,
};
export type { ArticleCommentThreadItem };
