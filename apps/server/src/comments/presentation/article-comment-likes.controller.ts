import {
  Controller,
  Delete,
  NotFoundException,
  Param,
  Put,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { ArticleCommentLikeResponse } from "@adrian-zephyr-notes/contracts";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import { SESSION_COOKIE_NAME, parseCookies } from "../../auth/presentation/cookie";
import {
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentLikeTargetNotFoundError,
} from "../application/article-comment.errors";
import { LikeArticleCommentUseCase } from "../application/like-article-comment.use-case";
import { UnlikeArticleCommentUseCase } from "../application/unlike-article-comment.use-case";

@Controller("api/comments/:commentId/like")
class ArticleCommentLikesController {
  constructor(
    private readonly likeArticleComment: LikeArticleCommentUseCase,
    private readonly unlikeArticleComment: UnlikeArticleCommentUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Put()
  async like(
    @Param("commentId") commentId: string,
    @Req() request: Request,
  ): Promise<ArticleCommentLikeResponse> {
    try {
      const user = await this.getRequestUser(request);
      return await this.likeArticleComment.execute({
        commentId,
        user,
      });
    } catch (error) {
      throw mapArticleCommentLikeError(error);
    }
  }

  @Delete()
  async unlike(
    @Param("commentId") commentId: string,
    @Req() request: Request,
  ): Promise<ArticleCommentLikeResponse> {
    try {
      const user = await this.getRequestUser(request);
      return await this.unlikeArticleComment.execute({
        commentId,
        user,
      });
    } catch (error) {
      throw mapArticleCommentLikeError(error);
    }
  }

  private getRequestUser(request: Request) {
    const cookies = parseCookies(request.headers.cookie);
    return this.getCurrentUser.execute(cookies[SESSION_COOKIE_NAME]);
  }
}

function mapArticleCommentLikeError(error: unknown) {
  if (error instanceof ArticleCommentAuthenticationRequiredError) {
    return new UnauthorizedException({
      error: {
        code: "AUTH_REQUIRED",
        message: "Login is required to like comments",
      },
    });
  }

  if (error instanceof ArticleCommentLikeTargetNotFoundError) {
    return new NotFoundException({
      error: {
        code: "COMMENT_NOT_FOUND",
        message: "Comment not found",
      },
    });
  }

  return error;
}

export { ArticleCommentLikesController };
