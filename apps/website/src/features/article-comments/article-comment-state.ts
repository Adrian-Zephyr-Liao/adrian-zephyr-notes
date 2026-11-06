import type { ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";

function appendComment(
  comments: ArticleCommentResponse[],
  comment: ArticleCommentResponse,
): ArticleCommentResponse[] {
  if (!comment.parentCommentId) {
    return [...comments, comment];
  }

  return comments.map((current) => {
    if (current.id === comment.parentCommentId) {
      return {
        ...current,
        replies: [...current.replies, comment],
      };
    }

    return {
      ...current,
      replies: appendComment(current.replies, comment),
    };
  });
}

function mergeRootComments(
  currentComments: ArticleCommentResponse[],
  nextComments: ArticleCommentResponse[],
) {
  const currentIds = new Set(currentComments.map((comment) => comment.id));
  const uniqueNextComments = nextComments.filter((comment) => !currentIds.has(comment.id));
  return [...currentComments, ...uniqueNextComments];
}

export { appendComment, mergeRootComments };
