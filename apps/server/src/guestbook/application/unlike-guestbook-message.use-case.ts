import { Inject, Injectable } from "@nestjs/common";
import {
  GUESTBOOK_MESSAGE_LIKE_REPOSITORY,
  type GuestbookMessageLikeRepository,
} from "../domain/guestbook-message-like.repository";
import type { CurrentGuestbookUser } from "../domain/guestbook-message.repository";
import {
  GuestbookMessageAuthenticationRequiredError,
  GuestbookMessageLikeTargetNotFoundError,
} from "./guestbook-message.errors";

@Injectable()
class UnlikeGuestbookMessageUseCase {
  constructor(
    @Inject(GUESTBOOK_MESSAGE_LIKE_REPOSITORY)
    private readonly guestbookMessageLikeRepository: GuestbookMessageLikeRepository,
  ) {}

  async execute(input: { messageId: string; user: CurrentGuestbookUser | null }) {
    if (!input.user) {
      throw new GuestbookMessageAuthenticationRequiredError();
    }

    const likeState = await this.guestbookMessageLikeRepository.unlikeVisibleMessage(
      input.messageId,
      input.user.id,
    );

    if (!likeState) {
      throw new GuestbookMessageLikeTargetNotFoundError();
    }

    return likeState;
  }
}

export { UnlikeGuestbookMessageUseCase };
