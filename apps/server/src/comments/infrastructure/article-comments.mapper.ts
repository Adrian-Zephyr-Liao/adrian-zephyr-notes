import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Prisma } from "@prisma/client";

const EMPTY_VIEWER_USER_ID = "00000000-0000-0000-0000-000000000000";

function createArticleCommentInclude(viewerUserId?: string | null) {
  return {
    author: true,
    likes: {
      where: {
        userId: viewerUserId ?? EMPTY_VIEWER_USER_ID,
      },
      select: {
        userId: true,
      },
      take: 1,
    },
  } satisfies Prisma.ArticleCommentInclude;
}

const articleCommentInclude = createArticleCommentInclude();

const articleCommentCreateInclude = {
  author: true,
} satisfies Prisma.ArticleCommentInclude;

type ArticleCommentRecord = Prisma.ArticleCommentGetPayload<{
  include: typeof articleCommentInclude;
}>;

type CreatedArticleCommentRecord = Prisma.ArticleCommentGetPayload<{
  include: typeof articleCommentCreateInclude;
}>;

type ArticleCommentTreeRecord = ArticleCommentRecord & {
  replies: ArticleCommentTreeRecord[];
};

function toArticleCommentResponse(
  comment: ArticleCommentRecord | ArticleCommentTreeRecord | CreatedArticleCommentRecord,
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
    likeCount: comment.likeCount,
    likedByMe: "likes" in comment ? comment.likes.length > 0 : false,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function isArticleCommentTreeRecord(
  comment: ArticleCommentRecord | ArticleCommentTreeRecord | CreatedArticleCommentRecord,
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
  articleCommentCreateInclude,
  createArticleCommentInclude,
  type ArticleCommentRecord,
  type ArticleCommentTreeRecord,
  type CreatedArticleCommentRecord,
  toArticleCommentResponse,
  toArticleCommentsResponse,
};
