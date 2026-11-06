import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
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
  AdminArticleCommentListItemResponse,
  AdminArticleCommentListResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  toAdminOperationActor,
  toAdminOperationRequestContext,
} from "../../audit/presentation/admin-audit-context";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import {
  AdminApiAccess,
  AdminApiAccessGuard,
} from "../../oauth/presentation/admin-api-access.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import {
  AdminArticleCommentNotFoundError,
  AdminArticleCommentValidationError,
  AdminArticleCommentConflictError,
} from "../application/admin-article-comment.errors";
import { ListAdminArticleCommentsUseCase } from "../application/list-admin-article-comments.use-case";
import { UpdateAdminArticleCommentStatusUseCase } from "../application/update-admin-article-comment-status.use-case";
import {
  toAdminArticleCommentListItemResponse,
  toAdminArticleCommentListResponse,
} from "../infrastructure/admin-article-comments.mapper";
import { AdminArticleCommentListQueryDto } from "./dto/admin-article-comment-list-query.dto";
import { UpdateAdminArticleCommentDto } from "./dto/update-admin-article-comment.dto";

@Controller("api/admin/comments")
@UseGuards(AdminApiAccessGuard)
class AdminArticleCommentsController {
  constructor(
    private readonly listAdminArticleComments: ListAdminArticleCommentsUseCase,
    private readonly updateAdminArticleCommentStatus: UpdateAdminArticleCommentStatusUseCase,
  ) {}

  @Get()
  @AdminApiAccess("admin:read")
  async list(
    @Query() query: AdminArticleCommentListQueryDto,
  ): Promise<AdminArticleCommentListResponse> {
    const result = await this.listAdminArticleComments.execute({
      commentId: query.commentId,
      page: query.page,
      pageSize: query.pageSize,
      search: query.q,
      status: query.status,
    });

    return toAdminArticleCommentListResponse(result);
  }

  @Patch(":id")
  @AdminApiAccess("admin:write")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAdminArticleCommentDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleCommentListItemResponse> {
    try {
      const comment = await this.updateAdminArticleCommentStatus.execute({
        id,
        status: body.status,
        actor: toAdminOperationActor(admin),
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminArticleCommentListItemResponse(comment);
    } catch (error) {
      throw mapAdminArticleCommentError(error);
    }
  }
}

function mapAdminArticleCommentError(error: unknown) {
  if (error instanceof AdminArticleCommentConflictError)
    return new ConflictException({ error: { code: "COMMENT_CHANGED", message: error.message } });
  if (error instanceof AdminArticleCommentNotFoundError) {
    return new NotFoundException({
      error: {
        code: "ADMIN_COMMENT_NOT_FOUND",
        message: "Comment not found",
      },
    });
  }

  if (error instanceof AdminArticleCommentValidationError) {
    return new BadRequestException({
      error: {
        code: "ADMIN_COMMENT_VALIDATION_FAILED",
        message: error.message,
      },
    });
  }

  return error;
}

export { AdminArticleCommentsController };
