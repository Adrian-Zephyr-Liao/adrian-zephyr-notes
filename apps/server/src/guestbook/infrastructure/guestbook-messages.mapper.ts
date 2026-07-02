import type {
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Prisma } from "@prisma/client";

const EMPTY_VIEWER_USER_ID = "00000000-0000-0000-0000-000000000000";

function createGuestbookMessageInclude(viewerUserId?: string | null) {
  return {
    author: true,
    likes: {
      where: {
        userId: viewerUserId ?? EMPTY_VIEWER_USER_ID,
      },
      select: {
        userId: true,
      },
      take: 1,
    },
  } satisfies Prisma.GuestbookMessageInclude;
}

const guestbookMessageInclude = createGuestbookMessageInclude();

const guestbookMessageCreateInclude = {
  author: true,
} satisfies Prisma.GuestbookMessageInclude;

type GuestbookMessageRecord = Prisma.GuestbookMessageGetPayload<{
  include: typeof guestbookMessageInclude;
}>;

type CreatedGuestbookMessageRecord = Prisma.GuestbookMessageGetPayload<{
  include: typeof guestbookMessageCreateInclude;
}>;

function toGuestbookMessageResponse(
  message: GuestbookMessageRecord | CreatedGuestbookMessageRecord,
): GuestbookMessageResponse {
  return {
    id: message.id,
    body: message.body,
    author: message.author
      ? {
          type: "GITHUB",
          id: message.author.id,
          login: message.author.login,
          name: message.author.name,
          avatarUrl: message.author.avatarUrl,
          profileUrl: message.author.profileUrl,
        }
      : {
          type: "GUEST",
          nickname: message.guestNickname ?? "访客",
          avatarSeed: message.guestFingerprint ?? message.id,
        },
    likeCount: message.likeCount,
    likedByMe: "likes" in message ? message.likes.length > 0 : false,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function toGuestbookMessagesResponse(messages: {
  data: GuestbookMessageRecord[];
  pagination: GuestbookMessagesResponse["pagination"];
}): GuestbookMessagesResponse {
  return {
    data: messages.data.map(toGuestbookMessageResponse),
    pagination: messages.pagination,
  };
}

export {
  createGuestbookMessageInclude,
  guestbookMessageCreateInclude,
  type CreatedGuestbookMessageRecord,
  type GuestbookMessageRecord,
  toGuestbookMessageResponse,
  toGuestbookMessagesResponse,
};
