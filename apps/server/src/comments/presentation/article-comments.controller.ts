import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import { getCurrentUserFromRequest } from "../../auth/presentation/request-session";
import {
  ArticleCommentBodyEmptyError,
  ArticleCommentBodyTooLongError,
} from "../domain/article-comment.entity";
import {
  ArticleCommentArticleNotFoundError,
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentLikeTargetNotFoundError,
  ArticleCommentParentNotFoundError,
} from "../application/article-comment.errors";
import { CreateArticleCommentUseCase } from "../application/create-article-comment.use-case";
import { ListVisibleArticleCommentsUseCase } from "../application/list-visible-article-comments.use-case";
import {
  type ArticleCommentTreeRecord,
  type CreatedArticleCommentRecord,
  toArticleCommentResponse,
  toArticleCommentsResponse,
} from "../infrastructure/article-comments.mapper";
import { ArticleCommentsQueryDto } from "./dto/article-comments-query.dto";
import { CreateArticleCommentDto } from "./dto/create-article-comment.dto";

@Controller("api/articles/:slug/comments")
class ArticleCommentsController {
  constructor(
    private readonly createArticleComment: CreateArticleCommentUseCase<CreatedArticleCommentRecord>,
    private readonly listVisibleArticleComments: ListVisibleArticleCommentsUseCase<ArticleCommentTreeRecord>,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Get()
  async list(
    @Param("slug") slug: string,
    @Query() query: ArticleCommentsQueryDto,
    @Req() request: Request,
  ): Promise<ArticleCommentsResponse> {
    try {
      const user = await getCurrentUserFromRequest(request, this.getCurrentUser);
      const comments = await this.listVisibleArticleComments.execute(slug, {
        page: query.page,
        pageSize: query.pageSize,
        viewerUserId: user?.id ?? null,
      });
      return toArticleCommentsResponse(comments);
    } catch (error) {
      throw mapArticleCommentError(error);
    }
  }

  @Post()
  async create(
    @Param("slug") slug: string,
    @Body() body: CreateArticleCommentDto,
    @Req() request: Request,
  ): Promise<ArticleCommentResponse> {
    try {
      const user = await getCurrentUserFromRequest(request, this.getCurrentUser);
      const comment = await this.createArticleComment.execute({
        slug,
        body: body.body,
        parentCommentId: body.parentCommentId,
        user,
      });
      return toArticleCommentResponse(comment);
    } catch (error) {
      throw mapArticleCommentError(error);
    }
  }
}

function mapArticleCommentError(error: unknown) {
  if (error instanceof ArticleCommentArticleNotFoundError) {
    return new NotFoundException({
      error: {
        code: "ARTICLE_NOT_FOUND",
        message: "Article not found",
      },
    });
  }

  if (error instanceof ArticleCommentAuthenticationRequiredError) {
    return new UnauthorizedException({
      error: {
        code: "AUTH_REQUIRED",
        message: "Login is required to comment",
      },
    });
  }

  if (error instanceof ArticleCommentBodyEmptyError) {
    return new BadRequestException({
      error: {
        code: "COMMENT_BODY_EMPTY",
        message: "Comment body is required",
      },
    });
  }

  if (error instanceof ArticleCommentBodyTooLongError) {
    return new BadRequestException({
      error: {
        code: "COMMENT_BODY_TOO_LONG",
        message: "Comment body is too long",
      },
    });
  }

  if (error instanceof ArticleCommentParentNotFoundError) {
    return new NotFoundException({
      error: {
        code: "PARENT_COMMENT_NOT_FOUND",
        message: "Parent comment not found",
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

export { ArticleCommentsController };
