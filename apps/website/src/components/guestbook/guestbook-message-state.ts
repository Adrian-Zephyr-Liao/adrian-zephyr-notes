import type {
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
} from "@adrian-zephyr-notes/contracts";

function applyGuestbookMessageLikeState(
  messages: GuestbookMessageResponse[],
  likeState: GuestbookMessageLikeResponse,
): GuestbookMessageResponse[] {
  return messages.map((message) =>
    message.id === likeState.messageId
      ? {
          ...message,
          likeCount: likeState.likeCount,
          likedByMe: likeState.likedByMe,
        }
      : message,
  );
}

function prependGuestbookMessage(
  messages: GuestbookMessageResponse[],
  message: GuestbookMessageResponse,
): GuestbookMessageResponse[] {
  if (messages.some((current) => current.id === message.id)) {
    return messages;
  }

  return [message, ...messages];
}

function appendUniqueGuestbookMessages(
  currentMessages: GuestbookMessageResponse[],
  nextMessages: GuestbookMessageResponse[],
) {
  const currentIds = new Set(currentMessages.map((message) => message.id));
  const uniqueNextMessages = nextMessages.filter((message) => !currentIds.has(message.id));
  return [...currentMessages, ...uniqueNextMessages];
}

export { appendUniqueGuestbookMessages, applyGuestbookMessageLikeState, prependGuestbookMessage };
