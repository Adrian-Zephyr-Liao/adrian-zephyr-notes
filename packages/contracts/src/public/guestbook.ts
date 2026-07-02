import type { PaginatedResponse } from "./pagination.js";

type GuestbookMessagesQuery = {
  page?: number;
  pageSize?: number;
};

type GuestbookMessageAuthor =
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

type GuestbookMessageResponse = {
  id: string;
  body: string;
  author: GuestbookMessageAuthor;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

type GuestbookMessagesResponse = PaginatedResponse<GuestbookMessageResponse>;

type GuestbookMessageLikeResponse = {
  messageId: string;
  likeCount: number;
  likedByMe: boolean;
};

type CreateGuestbookMessageRequest = {
  body: string;
  guestNickname?: string | null;
  website?: string | null;
};

export type {
  CreateGuestbookMessageRequest,
  GuestbookMessageAuthor,
  GuestbookMessageLikeResponse,
  GuestbookMessageResponse,
  GuestbookMessagesQuery,
  GuestbookMessagesResponse,
};
