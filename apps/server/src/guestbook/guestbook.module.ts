import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateGuestbookMessageUseCase } from "./application/create-guestbook-message.use-case";
import { LikeGuestbookMessageUseCase } from "./application/like-guestbook-message.use-case";
import { ListAdminGuestbookMessagesUseCase } from "./application/list-admin-guestbook-messages.use-case";
import { ListVisibleGuestbookMessagesUseCase } from "./application/list-visible-guestbook-messages.use-case";
import { UnlikeGuestbookMessageUseCase } from "./application/unlike-guestbook-message.use-case";
import { UpdateAdminGuestbookMessageUseCase } from "./application/update-admin-guestbook-message.use-case";
import { ADMIN_GUESTBOOK_MESSAGE_REPOSITORY } from "./domain/admin-guestbook-message.repository";
import { GUESTBOOK_MESSAGE_LIKE_REPOSITORY } from "./domain/guestbook-message-like.repository";
import { GUESTBOOK_MESSAGE_REPOSITORY } from "./domain/guestbook-message.repository";
import { PrismaAdminGuestbookMessageRepository } from "./infrastructure/prisma-admin-guestbook-message.repository";
import { PrismaGuestbookMessageLikeRepository } from "./infrastructure/prisma-guestbook-message-like.repository";
import { PrismaGuestbookMessageRepository } from "./infrastructure/prisma-guestbook-message.repository";
import { AdminGuestbookMessagesController } from "./presentation/admin-guestbook-messages.controller";
import { GuestbookMessageLikesController } from "./presentation/guestbook-message-likes.controller";
import { GuestbookMessagesController } from "./presentation/guestbook-messages.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [
    GuestbookMessagesController,
    GuestbookMessageLikesController,
    AdminGuestbookMessagesController,
  ],
  providers: [
    CreateGuestbookMessageUseCase,
    LikeGuestbookMessageUseCase,
    ListAdminGuestbookMessagesUseCase,
    ListVisibleGuestbookMessagesUseCase,
    UnlikeGuestbookMessageUseCase,
    UpdateAdminGuestbookMessageUseCase,
    {
      provide: ADMIN_GUESTBOOK_MESSAGE_REPOSITORY,
      useClass: PrismaAdminGuestbookMessageRepository,
    },
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
