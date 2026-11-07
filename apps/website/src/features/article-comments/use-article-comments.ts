import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArticleCommentLikeResponse,
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";

import { useDiscussionDraft } from "../discussion-draft";
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
  const [expandedCommentIds, setExpandedCommentIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [likingCommentIds, setLikingCommentIds] = useState<ReadonlySet<string>>(() => new Set());
  const requestVersion = useRef(0);
  const [initialLoadState, setInitialLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent(`/posts/${slug}`)}`,
    [slug],
  );

  const draft = useDiscussionDraft(`article:${slug}`, loginUrl);
  const body = draft.body;
  const replyTarget = findLoadedComment(comments, draft.replyId);
  const unresolvedReply = Boolean(draft.replyId && !replyTarget);
  const submissionPending = useRef(false);

  const loadInitialComments = useCallback(
    async (version: number) => {
      setInitialLoadState("loading");
      setLoadErrorMessage(null);
      try {
        const result = await loadArticleComments(slug);
        if (requestVersion.current !== version) return;
        setComments(result.data);
        setPagination(result.pagination);
        setInitialLoadState("ready");
      } catch {
        if (requestVersion.current !== version) return;
        setInitialLoadState("error");
        setLoadErrorMessage("评论加载失败，请重试。");
      }
    },
    [slug],
  );

  useEffect(() => {
    const version = ++requestVersion.current;
    setComments([]);
    setPagination(null);
    setUser(null);
    setExpandedCommentIds(new Set());
    setLikingCommentIds(new Set());
    setErrorMessage(null);
    submissionPending.current = false;
    setIsSubmitting(false);
    setIsLoadingMore(false);
    void loadInitialComments(version);
    void loadCurrentUser().then((currentUser) => {
      if (requestVersion.current === version) setUser(currentUser);
    });
    return () => {
      requestVersion.current = version + 1;
    };
  }, [loadInitialComments]);

  function retryLoadComments() {
    return loadInitialComments(requestVersion.current);
  }

  async function submitComment() {
    const trimmedBody = body.trim();

    if (
      !trimmedBody ||
      submissionPending.current ||
      unresolvedReply ||
      initialLoadState !== "ready"
    ) {
      return;
    }

    const version = requestVersion.current;
    const submittedDraft = draft.capture();
    submissionPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const comment = await createArticleComment({
        body: trimmedBody,
        parentCommentId: replyTarget?.id ?? null,
        slug,
      });
      draft.clearSubmitted(submittedDraft);
      if (requestVersion.current !== version) return;
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
    } catch (error) {
      if (requestVersion.current !== version) return;
      if (isApiRequestError(error) && error.status === 401) {
        draft.login();
        return;
      }

      setErrorMessage(
        isApiRequestError(error) && error.status >= 400 && error.status < 500
          ? "评论未发布，请检查内容或稍后重试。"
          : "发布结果尚未确认，请先核对已有评论后再试。",
      );
    } finally {
      if (requestVersion.current === version) {
        submissionPending.current = false;
        setIsSubmitting(false);
      }
    }
  }

  async function logout() {
    const version = requestVersion.current;
    try {
      await logoutCurrentUser();
      if (requestVersion.current === version) setUser(null);
    } catch {
      if (requestVersion.current === version) setErrorMessage("退出失败，请稍后重试。");
    }
  }

  function replyToComment(target: ArticleCommentResponse) {
    if (isSubmitting) return;
    draft.update({ replyId: target.id });
    if (!user) {
      draft.login();
      return;
    }
    textareaRef.current?.focus();
    setErrorMessage(null);
  }

  async function toggleLike(target: ArticleCommentResponse) {
    if (!user) {
      draft.login();
      return;
    }

    if (likingCommentIds.has(target.id)) {
      return;
    }

    const version = requestVersion.current;
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
      if (requestVersion.current !== version) return;
      setComments((current) => applyCommentLikeState(current, likeState));
    } catch (error) {
      if (requestVersion.current !== version) return;
      if (isApiRequestError(error) && error.status === 401) {
        setComments((current) => applyCommentLikeState(current, previousLikeState));
        draft.login();
        return;
      }

      setComments((current) => applyCommentLikeState(current, previousLikeState));
      setErrorMessage("点赞操作失败，请稍后重试。");
    } finally {
      if (requestVersion.current === version)
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

    const version = requestVersion.current;
    setIsLoadingMore(true);
    setLoadErrorMessage(null);

    try {
      const nextPage = pagination.page + 1;
      const nextComments = await loadArticleComments(slug, nextPage, pagination.pageSize);
      if (requestVersion.current !== version) return;
      setComments((current) => mergeRootComments(current, nextComments.data));
      setPagination(nextComments.pagination);
    } catch {
      if (requestVersion.current === version) setLoadErrorMessage("加载更多评论失败，请重试。");
    } finally {
      if (requestVersion.current === version) setIsLoadingMore(false);
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
    draft,
    unresolvedReply,
    canLoadMore: pagination ? pagination.page < pagination.totalPages : false,
    commentThreads: createArticleCommentThreads(comments),
    comments,
    errorMessage,
    expandedCommentIds,
    initialLoadState,
    loadErrorMessage,
    retryLoadComments,
    isLoadingMore,
    isSubmitting,
    likingCommentIds,
    loadMore,
    loginUrl,
    logout,
    pagination,
    replyTarget,
    replyToComment,
    setBody: (value: string) => draft.update({ body: value }),
    submitComment,
    textareaRef,
    toggleLike,
    toggleReplyExpansion,
    user,
    cancelReply: () => {
      if (!isSubmitting) draft.update({ replyId: null });
    },
  };
}

function findLoadedComment(
  comments: ArticleCommentResponse[],
  id: string | null,
): ArticleCommentResponse | null {
  if (!id) return null;
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const child = findLoadedComment(comment.replies, id);
    if (child) return child;
  }
  return null;
}
export { useArticleComments };
