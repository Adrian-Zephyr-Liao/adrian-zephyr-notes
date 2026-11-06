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
  authorUserId: string;
  guestNickname: null;
  guestFingerprint: null;
  body: string;
};

type CreateAnonymousGuestbookMessageInput = {
  guestNickname: string;
  guestFingerprint: string;
  body: string;
};

type AnonymousGuestbookMessageLimit = { since: Date; limit: number };

interface GuestbookMessageRepository<TMessage = unknown> {
  createAnonymousWithinLimit(
    input: CreateAnonymousGuestbookMessageInput,
    policy: AnonymousGuestbookMessageLimit,
  ): Promise<TMessage | null>;
  create(input: CreateGuestbookMessageInput): Promise<TMessage>;
  listVisible(input: GuestbookMessagesListInput): Promise<GuestbookMessagesPage<TMessage>>;
}

type CurrentGuestbookUser = {
  id: string;
};

const GUESTBOOK_MESSAGE_REPOSITORY = Symbol("GUESTBOOK_MESSAGE_REPOSITORY");

export {
  GUESTBOOK_MESSAGE_REPOSITORY,
  type AnonymousGuestbookMessageLimit,
  type CreateAnonymousGuestbookMessageInput,
  type CreateGuestbookMessageInput,
  type CurrentGuestbookUser,
  type GuestbookMessageRepository,
  type GuestbookMessagesListInput,
  type GuestbookMessagesPage,
};
