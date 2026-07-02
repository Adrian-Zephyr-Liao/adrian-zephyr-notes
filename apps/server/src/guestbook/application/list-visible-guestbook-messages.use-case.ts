import { Inject, Injectable } from "@nestjs/common";
import {
  GUESTBOOK_MESSAGE_REPOSITORY,
  type GuestbookMessageRepository,
} from "../domain/guestbook-message.repository";
import {
  normalizeGuestbookMessagesQuery,
  type GuestbookMessagesPaginationInput,
} from "./guestbook-messages-pagination";

@Injectable()
class ListVisibleGuestbookMessagesUseCase<TMessage = unknown> {
  constructor(
    @Inject(GUESTBOOK_MESSAGE_REPOSITORY)
    private readonly guestbookMessageRepository: GuestbookMessageRepository<TMessage>,
  ) {}

  execute(input: GuestbookMessagesPaginationInput = {}) {
    return this.guestbookMessageRepository.listVisible({
      ...normalizeGuestbookMessagesQuery(input),
      viewerUserId: input.viewerUserId,
    });
  }
}

export { ListVisibleGuestbookMessagesUseCase };
