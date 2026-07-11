import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  AdminArticleTagListResponse,
  AdminArticleTagResponse,
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
  CreateAdminArticleTagUseCase,
  DeleteAdminArticleTagUseCase,
  ListAdminArticleTagsUseCase,
  MergeAdminArticleTagUseCase,
  UpdateAdminArticleTagUseCase,
} from "../application/admin-article-tag.use-cases";
import {
  AdminArticleTagConflictError,
  AdminArticleTagInUseError,
  AdminArticleTagNotFoundError,
  AdminArticleTagValidationError,
  type AdminArticleTag,
} from "../domain/admin-article-tag.repository";
import {
  AdminArticleTagListQueryDto,
  CreateAdminArticleTagDto,
  MergeAdminArticleTagDto,
  UpdateAdminArticleTagDto,
} from "./dto/admin-article-tag.dto";

@Controller("api/admin/article-tags")
@UseGuards(AdminAuthGuard)
class AdminArticleTagsController {
  private readonly logger = new Logger(AdminArticleTagsController.name);

  constructor(
    private readonly createTag: CreateAdminArticleTagUseCase,
    private readonly deleteTag: DeleteAdminArticleTagUseCase,
    private readonly listTags: ListAdminArticleTagsUseCase,
    private readonly mergeTag: MergeAdminArticleTagUseCase,
    private readonly recordOperation: RecordAdminOperationUseCase,
    private readonly updateTag: UpdateAdminArticleTagUseCase,
  ) {}

  @Get()
  async list(@Query() query: AdminArticleTagListQueryDto): Promise<AdminArticleTagListResponse> {
    const page = await this.listTags.execute(query);
    return { data: page.data.map(toResponse), pagination: page.pagination };
  }

  @Post()
  async create(
    @Body() body: CreateAdminArticleTagDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleTagResponse> {
    try {
      const tag = await this.createTag.execute(body);
      await this.auditAfterMutation(
        "ARTICLE_TAG_CREATED",
        tag.id,
        { name: tag.name, slug: tag.slug },
        admin,
        request,
      );
      return toResponse(tag);
    } catch (error) {
      throw mapError(error);
    }
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAdminArticleTagDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleTagResponse> {
    try {
      const tag = await this.updateTag.execute(id, body);
      await this.auditAfterMutation(
        "ARTICLE_TAG_UPDATED",
        tag.id,
        { changedFields: Object.keys(body), slug: tag.slug },
        admin,
        request,
      );
      return toResponse(tag);
    } catch (error) {
      throw mapError(error);
    }
  }

  @Post(":id/merge")
  async merge(
    @Param("id") id: string,
    @Body() body: MergeAdminArticleTagDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleTagResponse> {
    try {
      const actor = toAdminOperationActor(admin);
      const requestContext = toAdminOperationRequestContext(request);
      const target = await this.mergeTag.execute(id, body.targetTagId, {
        actorLogin: actor.login,
        actorUserId: actor.id,
        ipAddress: requestContext.ipAddress ?? null,
        userAgent: requestContext.userAgent ?? null,
      });
      return toResponse(target);
    } catch (error) {
      throw mapError(error);
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @CurrentAdmin() admin: AuthUser, @Req() request: Request) {
    try {
      await this.deleteTag.execute(id);
      await this.auditAfterMutation("ARTICLE_TAG_DELETED", id, {}, admin, request);
    } catch (error) {
      throw mapError(error);
    }
  }

  private async auditAfterMutation(
    action:
      | "ARTICLE_TAG_CREATED"
      | "ARTICLE_TAG_DELETED"
      | "ARTICLE_TAG_MERGED"
      | "ARTICLE_TAG_UPDATED",
    resourceId: string,
    metadata: Record<string, unknown>,
    admin: AuthUser,
    request: Request,
  ) {
    try {
      await this.recordOperation.execute({
        action,
        actor: toAdminOperationActor(admin),
        metadata,
        requestContext: toAdminOperationRequestContext(request),
        resourceId,
        resourceType: "article_tag",
      });
    } catch (error) {
      this.logger.error(
        `Article tag mutation succeeded but audit persistence failed: ${action} ${resourceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function toResponse(tag: AdminArticleTag): AdminArticleTagResponse {
  return { ...tag, createdAt: tag.createdAt.toISOString(), updatedAt: tag.updatedAt.toISOString() };
}
function mapError(error: unknown) {
  if (error instanceof AdminArticleTagNotFoundError)
    return new NotFoundException({
      error: { code: "ADMIN_ARTICLE_TAG_NOT_FOUND", message: "Article tag not found." },
    });
  if (error instanceof AdminArticleTagConflictError)
    return new ConflictException({
      error: { code: "ADMIN_ARTICLE_TAG_CONFLICT", message: "Tag name or slug already exists." },
    });
  if (error instanceof AdminArticleTagInUseError)
    return new ConflictException({
      error: { code: "ADMIN_ARTICLE_TAG_IN_USE", message: "Tag is still used by articles." },
    });
  if (error instanceof AdminArticleTagValidationError)
    return new BadRequestException({
      error: { code: "ADMIN_ARTICLE_TAG_VALIDATION_FAILED", message: error.message },
    });
  return error;
}

export { AdminArticleTagsController };
