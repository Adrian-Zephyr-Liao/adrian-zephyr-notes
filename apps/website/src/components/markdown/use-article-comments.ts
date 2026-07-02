import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ArticleCommentLikeResponse,
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";

import { isApiRequestError } from "@/lib/api-client";
import {
  createArticleComment,
  loadArticleComments,
  loadCurrentUser,
  logoutCurrentUser,
  toggleArticleCommentLike,
} from "./article-comment-api";
import { appendComment, mergeRootComments } from "./article-comment-state";
import {
  applyCommentLikeState,
  createArticleCommentThreads,
  findReplyExpansionTargetId,
} from "./article-comment-thread";

function useArticleComments(slug: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [comments, setComments] = useState<ArticleCommentResponse[]>([]);
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [pagination, setPagination] = useState<ArticleCommentsResponse["pagination"] | null>(null);
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ArticleCommentResponse | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [likingCommentIds, setLikingCommentIds] = useState<ReadonlySet<string>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent(`/posts/${slug}`)}`,
    [slug],
  );

  useEffect(() => {
    setExpandedCommentIds(new Set());
    void Promise.all([loadArticleComments(slug), loadCurrentUser()]).then(
      ([commentsResult, userResult]) => {
        setComments(commentsResult.data);
        setPagination(commentsResult.pagination);
        setUser(userResult);
      },
    );
  }, [slug]);

  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget]);

  async function submitComment() {
    const trimmedBody = body.trim();

    if (!trimmedBody || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const comment = await createArticleComment({
        body: trimmedBody,
        parentCommentId: replyTarget?.id ?? null,
        slug,
      });
      const expansionTargetId = comment.parentCommentId
        ? findReplyExpansionTargetId(comments, comment.parentCommentId)
        : null;

      setComments((current) => appendComment(current, comment));
      if (expansionTargetId) {
        setExpandedCommentIds((current) => new Set(current).add(expansionTargetId));
      }
      setPagination((current) =>
        current && !comment.parentCommentId
          ? {
              ...current,
              totalItems: current.totalItems + 1,
              totalPages: Math.max(
                current.totalPages,
                Math.ceil((current.totalItems + 1) / current.pageSize),
              ),
            }
          : current,
      );
      setBody("");
      setReplyTarget(null);
    } catch (error) {
      if (isApiRequestError(error) && error.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      setErrorMessage(replyTarget ? "回复发布失败，请稍后重试。" : "评论发布失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await logoutCurrentUser();
    setUser(null);
  }

  function replyToComment(target: ArticleCommentResponse) {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }

    setReplyTarget(target);
    setErrorMessage(null);
  }

  async function toggleLike(target: ArticleCommentResponse) {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }

    if (likingCommentIds.has(target.id)) {
      return;
    }

    const previousLikeState: ArticleCommentLikeResponse = {
      commentId: target.id,
      likeCount: target.likeCount,
      likedByMe: target.likedByMe,
    };
    const optimisticLikeState: ArticleCommentLikeResponse = {
      commentId: target.id,
      likeCount: Math.max(target.likeCount + (target.likedByMe ? -1 : 1), 0),
      likedByMe: !target.likedByMe,
    };

    setLikingCommentIds((current) => new Set(current).add(target.id));
    setComments((current) => applyCommentLikeState(current, optimisticLikeState));
    setErrorMessage(null);

    try {
      const likeState = await toggleArticleCommentLike(target);
      setComments((current) => applyCommentLikeState(current, likeState));
    } catch (error) {
      if (isApiRequestError(error) && error.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      setComments((current) => applyCommentLikeState(current, previousLikeState));
      setErrorMessage("点赞操作失败，请稍后重试。");
    } finally {
      setLikingCommentIds((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    }
  }

  async function loadMore() {
    if (!pagination || isLoadingMore || pagination.page >= pagination.totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = pagination.page + 1;
      const nextComments = await loadArticleComments(slug, nextPage, pagination.pageSize);
      setComments((current) => mergeRootComments(current, nextComments.data));
      setPagination(nextComments.pagination);
    } catch {
      setErrorMessage("加载更多评论失败，请稍后重试。");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function toggleReplyExpansion(commentId: string) {
    setExpandedCommentIds((current) => {
      const next = new Set(current);

      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }

      return next;
    });
  }

  return {
    body,
    canLoadMore: pagination ? pagination.page < pagination.totalPages : false,
    commentThreads: createArticleCommentThreads(comments),
    comments,
    errorMessage,
    expandedCommentIds,
    isLoadingMore,
    isSubmitting,
    likingCommentIds,
    loadMore,
    loginUrl,
    logout,
    pagination,
    replyTarget,
    replyToComment,
    setBody,
    submitComment,
    textareaRef,
    toggleLike,
    toggleReplyExpansion,
    user,
    cancelReply: () => setReplyTarget(null),
  };
}

export { useArticleComments };
