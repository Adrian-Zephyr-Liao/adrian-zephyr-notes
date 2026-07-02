import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateGuestbookMessageUseCase } from "./application/create-guestbook-message.use-case";
import { LikeGuestbookMessageUseCase } from "./application/like-guestbook-message.use-case";
import { ListVisibleGuestbookMessagesUseCase } from "./application/list-visible-guestbook-messages.use-case";
import { UnlikeGuestbookMessageUseCase } from "./application/unlike-guestbook-message.use-case";
import { GUESTBOOK_MESSAGE_LIKE_REPOSITORY } from "./domain/guestbook-message-like.repository";
import { GUESTBOOK_MESSAGE_REPOSITORY } from "./domain/guestbook-message.repository";
import { PrismaGuestbookMessageLikeRepository } from "./infrastructure/prisma-guestbook-message-like.repository";
import { PrismaGuestbookMessageRepository } from "./infrastructure/prisma-guestbook-message.repository";
import { GuestbookMessageLikesController } from "./presentation/guestbook-message-likes.controller";
import { GuestbookMessagesController } from "./presentation/guestbook-messages.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [GuestbookMessagesController, GuestbookMessageLikesController],
  providers: [
    CreateGuestbookMessageUseCase,
    LikeGuestbookMessageUseCase,
    ListVisibleGuestbookMessagesUseCase,
    UnlikeGuestbookMessageUseCase,
    {
      provide: GUESTBOOK_MESSAGE_REPOSITORY,
      useClass: PrismaGuestbookMessageRepository,
    },
    {
      provide: GUESTBOOK_MESSAGE_LIKE_REPOSITORY,
      useClass: PrismaGuestbookMessageLikeRepository,
    },
  ],
})
export class GuestbookModule {}
