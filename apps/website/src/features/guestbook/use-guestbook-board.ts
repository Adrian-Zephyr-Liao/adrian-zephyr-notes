import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AuthUserResponse,
  CreateGuestbookMessageRequest,
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import { useDiscussionDraft } from "../discussion-draft";
import { isApiRequestError } from "@/lib/api-client";

import {
  createGuestbookMessage,
  loadCurrentUser,
  loadGuestbookMessages,
  logoutCurrentUser,
  toggleGuestbookMessageLike,
} from "./guestbook-api";
import {
  appendUniqueGuestbookMessages,
  applyGuestbookMessageLikeState,
  prependGuestbookMessage,
} from "./guestbook-message-state";

function useGuestbookBoard() {
  const [messages, setMessages] = useState<GuestbookMessageResponse[]>([]);
  const [pagination, setPagination] = useState<GuestbookMessagesResponse["pagination"] | null>(
    null,
  );
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [website, setWebsite] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreController = useRef<AbortController | null>(null);
  const lifecycleVersion = useRef(0);
  const submissionPending = useRef(false);
  const likesPending = useRef(new Set<string>());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likingMessageIds, setLikingMessageIds] = useState<ReadonlySet<string>>(() => new Set());
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent("/comments")}`,
    [],
  );

  const draft = useDiscussionDraft("guestbook", loginUrl);
  const body = draft.body;
  const guestNickname = draft.nickname;

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    void loadGuestbookMessages(1, 20, controller.signal)
      .then((messagesResult) => {
        if (controller.signal.aborted) return;
        setMessages((current) => appendUniqueGuestbookMessages(current, messagesResult.data));
        setPagination(messagesResult.pagination);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });

    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    const version = ++lifecycleVersion.current;
    void loadCurrentUser().then((result) => {
      if (lifecycleVersion.current === version) setUser(result);
    });

    return () => {
      lifecycleVersion.current = version + 1;
      loadMoreController.current?.abort();
    };
  }, []);

  async function submitMessage() {
    const trimmedBody = body.trim();
    const trimmedNickname = guestNickname.trim();

    if (!trimmedBody || submissionPending.current || loadState !== "ready") {
      return;
    }

    if (!user && !trimmedNickname) {
      setErrorMessage("先留一个昵称，方便大家认识你。");
      return;
    }

    const payload: CreateGuestbookMessageRequest = {
      body: trimmedBody,
      guestNickname: user ? null : trimmedNickname,
      website,
    };
    const version = lifecycleVersion.current;
    const submittedDraft = draft.capture();

    submissionPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createGuestbookMessage(payload);
      if (result.kind === "created") draft.clearSubmitted(submittedDraft);
      if (lifecycleVersion.current !== version) return;

      if (result.kind === "rate-limited") {
        setErrorMessage("留言太频繁了，请稍后再试。");
        return;
      }

      setMessages((current) => prependGuestbookMessage(current, result.message));
      setPagination((current) =>
        current
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
      if (lifecycleVersion.current !== version) return;
      if (isApiRequestError(error) && error.status === 401) {
        draft.login();
        return;
      }
      setErrorMessage(
        isApiRequestError(error) && error.status >= 400 && error.status < 500
          ? "留言未发布，请检查内容或稍后重试。"
          : "发布结果尚未确认，请先核对已有留言后再试。",
      );
    } finally {
      if (lifecycleVersion.current === version) {
        submissionPending.current = false;
        setIsSubmitting(false);
      }
    }
  }

  async function logout() {
    const version = lifecycleVersion.current;
    try {
      await logoutCurrentUser();
      if (lifecycleVersion.current !== version) return;
      setUser(null);
      setErrorMessage(null);
    } catch {
      if (lifecycleVersion.current === version) setErrorMessage("退出登录失败，请稍后重试。");
    }
  }

  async function toggleLike(target: GuestbookMessageResponse) {
    if (!user) {
      draft.login();
      return;
    }

    if (likesPending.current.has(target.id)) {
      return;
    }
    const version = lifecycleVersion.current;

    const previousLikeState: GuestbookMessageLikeResponse = {
      messageId: target.id,
      likeCount: target.likeCount,
      likedByMe: target.likedByMe,
    };
    const optimisticLikeState: GuestbookMessageLikeResponse = {
      messageId: target.id,
      likeCount: Math.max(target.likeCount + (target.likedByMe ? -1 : 1), 0),
      likedByMe: !target.likedByMe,
    };

    likesPending.current.add(target.id);
    setLikingMessageIds((current) => new Set(current).add(target.id));
    setMessages((current) => applyGuestbookMessageLikeState(current, optimisticLikeState));
    setErrorMessage(null);

    try {
      const result = await toggleGuestbookMessageLike(target);
      if (lifecycleVersion.current !== version) return;

      if (result.kind === "auth-required") {
        setMessages((current) => applyGuestbookMessageLikeState(current, previousLikeState));
        draft.login();
        return;
      }

      setMessages((current) => applyGuestbookMessageLikeState(current, result.likeState));
    } catch {
      if (lifecycleVersion.current !== version) return;
      setMessages((current) => applyGuestbookMessageLikeState(current, previousLikeState));
      setErrorMessage("点赞操作失败，请稍后重试。");
    } finally {
      if (lifecycleVersion.current === version) {
        likesPending.current.delete(target.id);
        setLikingMessageIds((current) => {
          const next = new Set(current);
          next.delete(target.id);
          return next;
        });
      }
    }
  }

  async function loadMore() {
    if (!pagination || loadMoreController.current || pagination.page >= pagination.totalPages) {
      return;
    }

    const controller = new AbortController();
    loadMoreController.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const nextPage = pagination.page + 1;
      const nextMessages = await loadGuestbookMessages(
        nextPage,
        pagination.pageSize,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setMessages((current) => appendUniqueGuestbookMessages(current, nextMessages.data));
      setPagination(nextMessages.pagination);
    } catch {
      if (!controller.signal.aborted) setLoadMoreError("加载更多留言失败，已保留当前留言。");
    } finally {
      if (loadMoreController.current === controller) loadMoreController.current = null;
      if (!controller.signal.aborted) setIsLoadingMore(false);
    }
  }

  return {
    body,
    draft,
    canLoadMore: pagination ? pagination.page < pagination.totalPages : false,
    errorMessage,
    guestNickname,
    loadState,
    loadMoreError,
    isLoadingMore,
    isSubmitting,
    latestMessage: messages[0] ?? null,
    likingMessageIds,
    loginUrl,
    messages,
    pagination,
    setBody: (value: string) => draft.update({ body: value }),
    setGuestNickname: (value: string) => draft.update({ nickname: value }),
    setWebsite,
    submitMessage,
    loadMore,
    retryLoad: () => setLoadAttempt((current) => current + 1),
    logout,
    toggleLike,
    totalMessages: pagination?.totalItems ?? null,
    user,
    website,
  };
}

export { useGuestbookBoard };
