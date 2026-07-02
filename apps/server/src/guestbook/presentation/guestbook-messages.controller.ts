import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type {
  GuestbookMessageResponse,
  GuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import { SESSION_COOKIE_NAME, parseCookies } from "../../auth/presentation/cookie";
import {
  GuestbookMessageBodyEmptyError,
  GuestbookMessageBodyTooLongError,
  GuestbookNicknameRequiredError,
  GuestbookNicknameTooLongError,
} from "../domain/guestbook-message.entity";
import { CreateGuestbookMessageUseCase } from "../application/create-guestbook-message.use-case";
import {
  GuestbookMessageRateLimitedError,
  GuestbookMessageRejectedAsSpamError,
} from "../application/guestbook-message.errors";
import { ListVisibleGuestbookMessagesUseCase } from "../application/list-visible-guestbook-messages.use-case";
import {
  type CreatedGuestbookMessageRecord,
  type GuestbookMessageRecord,
  toGuestbookMessageResponse,
  toGuestbookMessagesResponse,
} from "../infrastructure/guestbook-messages.mapper";
import { CreateGuestbookMessageDto } from "./dto/create-guestbook-message.dto";
import { GuestbookMessagesQueryDto } from "./dto/guestbook-messages-query.dto";

@Controller("api/guestbook/messages")
class GuestbookMessagesController {
  constructor(
    private readonly createGuestbookMessage: CreateGuestbookMessageUseCase<CreatedGuestbookMessageRecord>,
    private readonly listVisibleGuestbookMessages: ListVisibleGuestbookMessagesUseCase<GuestbookMessageRecord>,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: GuestbookMessagesQueryDto,
    @Req() request: Request,
  ): Promise<GuestbookMessagesResponse> {
    const user = await this.getRequestUser(request);
    const messages = await this.listVisibleGuestbookMessages.execute({
      page: query.page,
      pageSize: query.pageSize,
      viewerUserId: user?.id ?? null,
    });

    return toGuestbookMessagesResponse(messages);
  }

  @Post()
  async create(
    @Body() body: CreateGuestbookMessageDto,
    @Req() request: Request,
  ): Promise<GuestbookMessageResponse> {
    try {
      const user = await this.getRequestUser(request);
      const message = await this.createGuestbookMessage.execute({
        body: body.body,
        guestNickname: body.guestNickname,
        guestFingerprint: createGuestFingerprint(request),
        honeypot: body.website,
        user,
      });

      return toGuestbookMessageResponse(message);
    } catch (error) {
      throw mapGuestbookMessageError(error);
    }
  }

  private getRequestUser(request: Request) {
    const cookies = parseCookies(request.headers.cookie);
    return this.getCurrentUser.execute(cookies[SESSION_COOKIE_NAME]);
  }
}

function createGuestFingerprint(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor?.split(",")[0]?.trim() ?? request.ip ?? "unknown");
  const userAgent = request.headers["user-agent"] ?? "unknown";

  return createHash("sha256").update(`${rawIp}:${userAgent}`).digest("hex");
}

function mapGuestbookMessageError(error: unknown) {
  if (
    error instanceof GuestbookMessageBodyEmptyError ||
    error instanceof GuestbookNicknameRequiredError
  ) {
    return new BadRequestException({
      error: {
        code: "GUESTBOOK_MESSAGE_REQUIRED",
        message: "Message body and guest nickname are required",
      },
    });
  }

  if (
    error instanceof GuestbookMessageBodyTooLongError ||
    error instanceof GuestbookNicknameTooLongError
  ) {
    return new BadRequestException({
      error: {
        code: "GUESTBOOK_MESSAGE_TOO_LONG",
        message: "Guestbook message input is too long",
      },
    });
  }

  if (error instanceof GuestbookMessageRejectedAsSpamError) {
    return new BadRequestException({
      error: {
        code: "GUESTBOOK_MESSAGE_REJECTED",
        message: "Guestbook message was rejected",
      },
    });
  }

  if (error instanceof GuestbookMessageRateLimitedError) {
    return new HttpException(
      {
        error: {
          code: "GUESTBOOK_RATE_LIMITED",
          message: "Too many guestbook messages, please try again later",
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  return error;
}

export { GuestbookMessagesController, createGuestFingerprint };
