import { useEffect, useMemo, useState } from "react";
import type {
  AuthUserResponse,
  CreateGuestbookMessageRequest,
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";

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
  const [guestNickname, setGuestNickname] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likingMessageIds, setLikingMessageIds] = useState<ReadonlySet<string>>(() => new Set());
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent("/comments")}`,
    [],
  );

  useEffect(() => {
    void Promise.all([loadGuestbookMessages(), loadCurrentUser()])
      .then(([messagesResult, userResult]) => {
        setMessages(messagesResult.data);
        setPagination(messagesResult.pagination);
        setUser(userResult);
      })
      .catch(() => {
        setErrorMessage("留言加载失败，请稍后重试。");
      });
  }, []);

  async function submitMessage() {
    const trimmedBody = body.trim();
    const trimmedNickname = guestNickname.trim();

    if (!trimmedBody || isSubmitting) {
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

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createGuestbookMessage(payload);

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
      setBody("");
    } catch {
      setErrorMessage("留言发布失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await logoutCurrentUser();
    setUser(null);
  }

  async function toggleLike(target: GuestbookMessageResponse) {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }

    if (likingMessageIds.has(target.id)) {
      return;
    }

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

    setLikingMessageIds((current) => new Set(current).add(target.id));
    setMessages((current) => applyGuestbookMessageLikeState(current, optimisticLikeState));
    setErrorMessage(null);

    try {
      const result = await toggleGuestbookMessageLike(target);

      if (result.kind === "auth-required") {
        window.location.href = loginUrl;
        return;
      }

      setMessages((current) => applyGuestbookMessageLikeState(current, result.likeState));
    } catch {
      setMessages((current) => applyGuestbookMessageLikeState(current, previousLikeState));
      setErrorMessage("点赞操作失败，请稍后重试。");
    } finally {
      setLikingMessageIds((current) => {
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
    setErrorMessage(null);

    try {
      const nextPage = pagination.page + 1;
      const nextMessages = await loadGuestbookMessages(nextPage, pagination.pageSize);
      setMessages((current) => appendUniqueGuestbookMessages(current, nextMessages.data));
      setPagination(nextMessages.pagination);
    } catch {
      setErrorMessage("加载更多留言失败，请稍后重试。");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return {
    body,
    canLoadMore: pagination ? pagination.page < pagination.totalPages : false,
    errorMessage,
    guestNickname,
    isLoadingMore,
    isSubmitting,
    latestMessage: messages[0] ?? null,
    likingMessageIds,
    loginUrl,
    messages,
    pagination,
    setBody,
    setGuestNickname,
    setWebsite,
    submitMessage,
    loadMore,
    logout,
    toggleLike,
    totalMessages: pagination?.totalItems ?? messages.length,
    user,
    website,
  };
}

export { useGuestbookBoard };
