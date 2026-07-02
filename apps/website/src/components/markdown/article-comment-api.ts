import type {
  ArticleCommentLikeResponse,
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";

import { requestJson } from "@/lib/api-client";

type AuthMeResponse = {
  user: AuthUserResponse | null;
};

async function loadArticleComments(
  slug: string,
  page = 1,
  pageSize = 20,
): Promise<ArticleCommentsResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    return await requestJson<ArticleCommentsResponse>(
      `/api/articles/${encodeURIComponent(slug)}/comments?${searchParams.toString()}`,
      {
        cache: "no-store",
      },
    );
  } catch {
    return {
      data: [],
      pagination: {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }
}

async function loadCurrentUser() {
  try {
    const payload = await requestJson<AuthMeResponse>("/api/auth/me", {
      cache: "no-store",
    });
    return payload.user;
  } catch {
    return null;
  }
}

function createArticleComment({
  body,
  parentCommentId,
  slug,
}: {
  body: string;
  parentCommentId: string | null;
  slug: string;
}) {
  return requestJson<ArticleCommentResponse>(`/api/articles/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    json: {
      body,
      parentCommentId,
    },
  });
}

function toggleArticleCommentLike(target: ArticleCommentResponse) {
  return requestJson<ArticleCommentLikeResponse>(
    `/api/comments/${encodeURIComponent(target.id)}/like`,
    {
      method: target.likedByMe ? "DELETE" : "PUT",
    },
  );
}

function logoutCurrentUser() {
  return requestJson("/api/auth/logout", {
    method: "POST",
  });
}

export {
  createArticleComment,
  loadArticleComments,
  loadCurrentUser,
  logoutCurrentUser,
  toggleArticleCommentLike,
};
