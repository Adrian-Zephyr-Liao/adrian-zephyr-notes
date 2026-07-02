import {
  Controller,
  Delete,
  NotFoundException,
  Param,
  Put,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { GuestbookMessageLikeResponse } from "@adrian-zephyr-notes/contracts";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import { SESSION_COOKIE_NAME, parseCookies } from "../../auth/presentation/cookie";
import {
  GuestbookMessageAuthenticationRequiredError,
  GuestbookMessageLikeTargetNotFoundError,
} from "../application/guestbook-message.errors";
import { LikeGuestbookMessageUseCase } from "../application/like-guestbook-message.use-case";
import { UnlikeGuestbookMessageUseCase } from "../application/unlike-guestbook-message.use-case";

@Controller("api/guestbook/messages/:messageId/like")
class GuestbookMessageLikesController {
  constructor(
    private readonly likeGuestbookMessage: LikeGuestbookMessageUseCase,
    private readonly unlikeGuestbookMessage: UnlikeGuestbookMessageUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Put()
  async like(
    @Param("messageId") messageId: string,
    @Req() request: Request,
  ): Promise<GuestbookMessageLikeResponse> {
    try {
      const user = await this.getRequestUser(request);
      return await this.likeGuestbookMessage.execute({
        messageId,
        user,
      });
    } catch (error) {
      throw mapGuestbookMessageLikeError(error);
    }
  }

  @Delete()
  async unlike(
    @Param("messageId") messageId: string,
    @Req() request: Request,
  ): Promise<GuestbookMessageLikeResponse> {
    try {
      const user = await this.getRequestUser(request);
      return await this.unlikeGuestbookMessage.execute({
        messageId,
        user,
      });
    } catch (error) {
      throw mapGuestbookMessageLikeError(error);
    }
  }

  private getRequestUser(request: Request) {
    const cookies = parseCookies(request.headers.cookie);
    return this.getCurrentUser.execute(cookies[SESSION_COOKIE_NAME]);
  }
}

function mapGuestbookMessageLikeError(error: unknown) {
  if (error instanceof GuestbookMessageAuthenticationRequiredError) {
    return new UnauthorizedException({
      error: {
        code: "AUTH_REQUIRED",
        message: "Login is required to like guestbook messages",
      },
    });
  }

  if (error instanceof GuestbookMessageLikeTargetNotFoundError) {
    return new NotFoundException({
      error: {
        code: "GUESTBOOK_MESSAGE_NOT_FOUND",
        message: "Guestbook message not found",
      },
    });
  }

  return error;
}

export { GuestbookMessageLikesController };
