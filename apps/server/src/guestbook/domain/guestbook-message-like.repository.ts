type GuestbookMessageLikeState = {
  messageId: string;
  likeCount: number;
  likedByMe: boolean;
};

interface GuestbookMessageLikeRepository {
  likeVisibleMessage(messageId: string, userId: string): Promise<GuestbookMessageLikeState | null>;
  unlikeVisibleMessage(
    messageId: string,
    userId: string,
  ): Promise<GuestbookMessageLikeState | null>;
}

const GUESTBOOK_MESSAGE_LIKE_REPOSITORY = Symbol("GUESTBOOK_MESSAGE_LIKE_REPOSITORY");

export {
  GUESTBOOK_MESSAGE_LIKE_REPOSITORY,
  type GuestbookMessageLikeRepository,
  type GuestbookMessageLikeState,
};
