import { Inject, Injectable } from "@nestjs/common";
import {
  GUESTBOOK_MESSAGE_REPOSITORY,
  type CurrentGuestbookUser,
  type GuestbookMessageRepository,
} from "../domain/guestbook-message.repository";
import { GuestbookMessageBody, GuestbookNickname } from "../domain/guestbook-message.entity";
import {
  GuestbookMessageRateLimitedError,
  GuestbookMessageRejectedAsSpamError,
} from "./guestbook-message.errors";

const ANONYMOUS_MESSAGE_LIMIT = 3;
const ANONYMOUS_MESSAGE_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
class CreateGuestbookMessageUseCase<TMessage = unknown> {
  constructor(
    @Inject(GUESTBOOK_MESSAGE_REPOSITORY)
    private readonly guestbookMessageRepository: GuestbookMessageRepository<TMessage>,
  ) {}

  async execute(input: {
    body: string;
    guestNickname?: string | null;
    guestFingerprint: string;
    honeypot?: string | null;
    user: CurrentGuestbookUser | null;
    now?: Date;
  }) {
    if (input.honeypot?.trim()) {
      throw new GuestbookMessageRejectedAsSpamError();
    }

    const body = GuestbookMessageBody.create(input.body);
    if (input.user) {
      return this.guestbookMessageRepository.create({
        authorUserId: input.user.id,
        guestNickname: null,
        guestFingerprint: null,
        body: body.toString(),
      });
    }

    const guestNickname = GuestbookNickname.create(input.guestNickname);
    const now = input.now ?? new Date();
    const message = await this.guestbookMessageRepository.createAnonymousWithinLimit(
      {
        guestNickname: guestNickname.toString(),
        guestFingerprint: input.guestFingerprint,
        body: body.toString(),
      },
      {
        limit: ANONYMOUS_MESSAGE_LIMIT,
        since: new Date(now.getTime() - ANONYMOUS_MESSAGE_WINDOW_MS),
      },
    );

    if (message === null) throw new GuestbookMessageRateLimitedError();
    return message;
  }
}

export { ANONYMOUS_MESSAGE_LIMIT, ANONYMOUS_MESSAGE_WINDOW_MS, CreateGuestbookMessageUseCase };
