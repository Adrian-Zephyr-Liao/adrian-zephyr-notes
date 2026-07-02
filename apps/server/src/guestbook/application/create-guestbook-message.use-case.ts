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
    const now = input.now ?? new Date();
    const guestNickname = input.user ? null : GuestbookNickname.create(input.guestNickname);

    if (!input.user) {
      const recentMessageCount = await this.guestbookMessageRepository.countRecentAnonymousMessages(
        {
          guestFingerprint: input.guestFingerprint,
          since: new Date(now.getTime() - ANONYMOUS_MESSAGE_WINDOW_MS),
        },
      );

      if (recentMessageCount >= ANONYMOUS_MESSAGE_LIMIT) {
        throw new GuestbookMessageRateLimitedError();
      }
    }

    return this.guestbookMessageRepository.create({
      authorUserId: input.user?.id ?? null,
      guestNickname: guestNickname?.toString() ?? null,
      guestFingerprint: input.user ? null : input.guestFingerprint,
      body: body.toString(),
    });
  }
}

export { ANONYMOUS_MESSAGE_LIMIT, ANONYMOUS_MESSAGE_WINDOW_MS, CreateGuestbookMessageUseCase };
