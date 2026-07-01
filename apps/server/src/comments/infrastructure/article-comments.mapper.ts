import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Prisma } from "@prisma/client";

const articleCommentInclude = {
  author: true,
} satisfies Prisma.ArticleCommentInclude;

type ArticleCommentRecord = Prisma.ArticleCommentGetPayload<{
  include: typeof articleCommentInclude;
}>;

type ArticleCommentTreeRecord = ArticleCommentRecord & {
  replies: ArticleCommentTreeRecord[];
};

function toArticleCommentResponse(
  comment: ArticleCommentRecord | ArticleCommentTreeRecord,
): ArticleCommentResponse {
  return {
    id: comment.id,
    body: comment.body,
    parentCommentId: comment.parentCommentId,
    author: {
      id: comment.author.id,
      login: comment.author.login,
      name: comment.author.name,
      avatarUrl: comment.author.avatarUrl,
      profileUrl: comment.author.profileUrl,
    },
    replies: isArticleCommentTreeRecord(comment)
      ? comment.replies.map(toArticleCommentResponse)
      : [],
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function isArticleCommentTreeRecord(
  comment: ArticleCommentRecord | ArticleCommentTreeRecord,
): comment is ArticleCommentTreeRecord {
  return "replies" in comment;
}

function toArticleCommentsResponse(comments: {
  data: ArticleCommentTreeRecord[];
  pagination: ArticleCommentsResponse["pagination"];
}): ArticleCommentsResponse {
  return {
    data: comments.data.map(toArticleCommentResponse),
    pagination: comments.pagination,
  };
}

export {
  articleCommentInclude,
  type ArticleCommentRecord,
  type ArticleCommentTreeRecord,
  toArticleCommentResponse,
  toArticleCommentsResponse,
};
