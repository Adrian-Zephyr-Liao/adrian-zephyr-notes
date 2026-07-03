type AdminGuestbookMessageStatus = "DELETED" | "HIDDEN" | "VISIBLE";

type ListAdminGuestbookMessagesFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: AdminGuestbookMessageStatus;
};

type AdminGuestbookMessageAuthor =
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

type AdminGuestbookMessageListItem = {
  id: string;
  body: string;
  author: AdminGuestbookMessageAuthor;
  guestFingerprint: string | null;
  status: AdminGuestbookMessageStatus;
  isPinned: boolean;
  pinnedAt: Date | null;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type AdminGuestbookMessagesPage = {
  data: AdminGuestbookMessageListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type UpdateAdminGuestbookMessageInput = {
  id: string;
  isPinned?: boolean;
  pinnedAt?: Date | null;
  status?: AdminGuestbookMessageStatus;
};

interface AdminGuestbookMessageRepository {
  list(filters: ListAdminGuestbookMessagesFilters): Promise<AdminGuestbookMessagesPage>;
  update(input: UpdateAdminGuestbookMessageInput): Promise<AdminGuestbookMessageListItem | null>;
}

const ADMIN_GUESTBOOK_MESSAGE_REPOSITORY = Symbol("ADMIN_GUESTBOOK_MESSAGE_REPOSITORY");

export { ADMIN_GUESTBOOK_MESSAGE_REPOSITORY };
export type {
  AdminGuestbookMessageAuthor,
  AdminGuestbookMessageListItem,
  AdminGuestbookMessageRepository,
  AdminGuestbookMessagesPage,
  AdminGuestbookMessageStatus,
  ListAdminGuestbookMessagesFilters,
  UpdateAdminGuestbookMessageInput,
};
