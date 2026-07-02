import type {
  AuthUserResponse,
  CreateGuestbookMessageRequest,
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import { isApiRequestError, requestJson } from "@/lib/api-client";

type AuthMeResponse = {
  user: AuthUserResponse | null;
};

async function loadGuestbookMessages(page = 1, pageSize = 20): Promise<GuestbookMessagesResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    return await requestJson<GuestbookMessagesResponse>(
      `/api/guestbook/messages?${searchParams.toString()}`,
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

async function createGuestbookMessage(payload: CreateGuestbookMessageRequest) {
  try {
    return {
      kind: "created" as const,
      message: await requestJson<GuestbookMessageResponse>("/api/guestbook/messages", {
        method: "POST",
        json: payload,
      }),
    };
  } catch (error) {
    if (isApiRequestError(error) && error.status === 429) {
      return {
        kind: "rate-limited" as const,
      };
    }

    throw error;
  }
}

async function toggleGuestbookMessageLike(target: GuestbookMessageResponse) {
  try {
    return {
      kind: "updated" as const,
      likeState: await requestJson<GuestbookMessageLikeResponse>(
        `/api/guestbook/messages/${encodeURIComponent(target.id)}/like`,
        {
          method: target.likedByMe ? "DELETE" : "PUT",
        },
      ),
    };
  } catch (error) {
    if (isApiRequestError(error) && error.status === 401) {
      return {
        kind: "auth-required" as const,
      };
    }

    throw error;
  }
}

function logoutCurrentUser() {
  return requestJson("/api/auth/logout", {
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
