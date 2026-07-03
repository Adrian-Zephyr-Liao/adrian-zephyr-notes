import type { PaginatedResponse } from "../public/pagination.js";

type AdminGuestbookMessageStatus = "DELETED" | "HIDDEN" | "VISIBLE";

type AdminGuestbookMessagesQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: AdminGuestbookMessageStatus | "ALL";
};

type AdminGuestbookMessageAuthorResponse =
  | {
      type: "GITHUB";
      id: string;
      login: string;
      name: string | null;
      avatarUrl: string | null;
      profileUrl: string;
    }
  | {
      type: "GUEST";
      nickname: string;
      avatarSeed: string;
    };

type AdminGuestbookMessageListItemResponse = {
  id: string;
  body: string;
  author: AdminGuestbookMessageAuthorResponse;
  guestFingerprint: string | null;
  status: AdminGuestbookMessageStatus;
  isPinned: boolean;
  pinnedAt: string | null;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

type AdminGuestbookMessagesResponse = PaginatedResponse<AdminGuestbookMessageListItemResponse>;

type UpdateAdminGuestbookMessageRequest = {
  status?: AdminGuestbookMessageStatus;
  isPinned?: boolean;
};

export type {
  AdminGuestbookMessageAuthorResponse,
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesQuery,
  AdminGuestbookMessagesResponse,
  AdminGuestbookMessageStatus,
  UpdateAdminGuestbookMessageRequest,
};
