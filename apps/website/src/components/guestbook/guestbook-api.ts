import type {
  AuthUserResponse,
  CreateGuestbookMessageRequest,
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";

type AuthMeResponse = {
  user: AuthUserResponse | null;
};

async function loadGuestbookMessages(page = 1, pageSize = 20): Promise<GuestbookMessagesResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/guestbook/messages?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
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

  return (await response.json()) as GuestbookMessagesResponse;
}

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as AuthMeResponse;
  return payload.user;
}

async function createGuestbookMessage(payload: CreateGuestbookMessageRequest) {
  const response = await fetch("/api/guestbook/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 429) {
    return {
      kind: "rate-limited" as const,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to publish guestbook message: ${response.status}`);
  }

  return {
    kind: "created" as const,
    message: (await response.json()) as GuestbookMessageResponse,
  };
}

async function toggleGuestbookMessageLike(target: GuestbookMessageResponse) {
  const response = await fetch(`/api/guestbook/messages/${encodeURIComponent(target.id)}/like`, {
    method: target.likedByMe ? "DELETE" : "PUT",
  });

  if (response.status === 401) {
    return {
      kind: "auth-required" as const,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to toggle guestbook like: ${response.status}`);
  }

  return {
    kind: "updated" as const,
    likeState: (await response.json()) as GuestbookMessageLikeResponse,
  };
}

function logoutCurrentUser() {
  return fetch("/api/auth/logout", {
    method: "POST",
  });
}

export {
  createGuestbookMessage,
  loadCurrentUser,
  loadGuestbookMessages,
  logoutCurrentUser,
  toggleGuestbookMessageLike,
};
