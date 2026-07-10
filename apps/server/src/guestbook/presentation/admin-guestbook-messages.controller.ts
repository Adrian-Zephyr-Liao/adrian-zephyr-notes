import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import {
  toAdminOperationActor,
  toAdminOperationRequestContext,
} from "../../audit/presentation/admin-audit-context";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import {
  AdminGuestbookMessageNotFoundError,
  AdminGuestbookMessageValidationError,
} from "../application/admin-guestbook-message.errors";
import { ListAdminGuestbookMessagesUseCase } from "../application/list-admin-guestbook-messages.use-case";
import { UpdateAdminGuestbookMessageUseCase } from "../application/update-admin-guestbook-message.use-case";
import {
  toAdminGuestbookMessageListItemResponse,
  toAdminGuestbookMessagesResponse,
} from "../infrastructure/admin-guestbook-messages.mapper";
import { AdminGuestbookMessagesQueryDto } from "./dto/admin-guestbook-messages-query.dto";
import { UpdateAdminGuestbookMessageDto } from "./dto/update-admin-guestbook-message.dto";

@Controller("api/admin/guestbook/messages")
@UseGuards(AdminAuthGuard)
class AdminGuestbookMessagesController {
  constructor(
    private readonly listAdminGuestbookMessages: ListAdminGuestbookMessagesUseCase,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateAdminGuestbookMessage: UpdateAdminGuestbookMessageUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: AdminGuestbookMessagesQueryDto,
  ): Promise<AdminGuestbookMessagesResponse> {
    const result = await this.listAdminGuestbookMessages.execute({
      page: query.page,
      pageSize: query.pageSize,
      search: query.q,
      status: query.status,
    });

    return toAdminGuestbookMessagesResponse(result);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAdminGuestbookMessageDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminGuestbookMessageListItemResponse> {
    try {
      const message = await this.updateAdminGuestbookMessage.execute({
        id,
        isPinned: body.isPinned,
        status: body.status,
      });

      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "GUESTBOOK_MESSAGE_UPDATED",
        resourceType: "guestbook_message",
        resourceId: message.id,
        metadata: {
          isPinned: message.isPinned,
          status: message.status,
        },
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminGuestbookMessageListItemResponse(message);
    } catch (error) {
      throw mapAdminGuestbookMessageError(error);
    }
  }
}

function mapAdminGuestbookMessageError(error: unknown) {
  if (error instanceof AdminGuestbookMessageNotFoundError) {
    return new NotFoundException({
      error: {
        code: "ADMIN_GUESTBOOK_MESSAGE_NOT_FOUND",
        message: "Guestbook message not found",
      },
    });
  }

  if (error instanceof AdminGuestbookMessageValidationError) {
    return new BadRequestException({
      error: {
        code: "ADMIN_GUESTBOOK_MESSAGE_VALIDATION_FAILED",
        message: error.message,
      },
    });
  }

  return error;
}

export { AdminGuestbookMessagesController };
