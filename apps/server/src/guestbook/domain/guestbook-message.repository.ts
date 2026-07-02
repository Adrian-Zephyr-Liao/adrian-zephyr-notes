type GuestbookMessagesListInput = {
  page: number;
  pageSize: number;
  viewerUserId?: string | null;
};

type GuestbookMessagesPage<TMessage> = {
  data: TMessage[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type CreateGuestbookMessageInput = {
  authorUserId: string | null;
  guestNickname: string | null;
  guestFingerprint: string | null;
  body: string;
};

interface GuestbookMessageRepository<TMessage = unknown> {
  countRecentAnonymousMessages(input: { guestFingerprint: string; since: Date }): Promise<number>;
  create(input: CreateGuestbookMessageInput): Promise<TMessage>;
  listVisible(input: GuestbookMessagesListInput): Promise<GuestbookMessagesPage<TMessage>>;
}

type CurrentGuestbookUser = {
  id: string;
};

const GUESTBOOK_MESSAGE_REPOSITORY = Symbol("GUESTBOOK_MESSAGE_REPOSITORY");

export {
  GUESTBOOK_MESSAGE_REPOSITORY,
  type CreateGuestbookMessageInput,
  type CurrentGuestbookUser,
  type GuestbookMessageRepository,
  type GuestbookMessagesListInput,
  type GuestbookMessagesPage,
};
