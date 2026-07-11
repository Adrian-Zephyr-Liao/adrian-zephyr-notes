import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  AdminArticleCategoryListResponse,
  AdminArticleCategoryResponse,
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
  CreateAdminArticleCategoryUseCase,
  DeleteAdminArticleCategoryUseCase,
  ListAdminArticleCategoriesUseCase,
  UpdateAdminArticleCategoryUseCase,
} from "../application/admin-article-category.use-cases";
import {
  AdminArticleCategoryConflictError,
  AdminArticleCategoryInUseError,
  AdminArticleCategoryNotFoundError,
  AdminArticleCategoryValidationError,
  type AdminArticleCategory,
} from "../domain/admin-article-category.repository";
import {
  AdminArticleCategoryListQueryDto,
  CreateAdminArticleCategoryDto,
  UpdateAdminArticleCategoryDto,
} from "./dto/admin-article-category.dto";

@Controller("api/admin/article-categories")
@UseGuards(AdminAuthGuard)
class AdminArticleCategoriesController {
  constructor(
    private readonly createCategory: CreateAdminArticleCategoryUseCase,
    private readonly deleteCategory: DeleteAdminArticleCategoryUseCase,
    private readonly listCategories: ListAdminArticleCategoriesUseCase,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateCategory: UpdateAdminArticleCategoryUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: AdminArticleCategoryListQueryDto,
  ): Promise<AdminArticleCategoryListResponse> {
    const page = await this.listCategories.execute(query);
    return {
      data: page.data.map(toResponse),
      pagination: page.pagination,
    };
  }

  @Post()
  async create(
    @Body() body: CreateAdminArticleCategoryDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleCategoryResponse> {
    try {
      const category = await this.createCategory.execute(body);
      await this.recordAdminOperation.execute({
        action: "ARTICLE_CATEGORY_CREATED",
        actor: toAdminOperationActor(admin),
        metadata: { name: category.name, slug: category.slug },
        requestContext: toAdminOperationRequestContext(request),
        resourceId: category.id,
        resourceType: "article_category",
      });
      return toResponse(category);
    } catch (error) {
      throw mapCategoryError(error);
    }
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAdminArticleCategoryDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleCategoryResponse> {
    try {
      const category = await this.updateCategory.execute(id, body);
      await this.recordAdminOperation.execute({
        action: "ARTICLE_CATEGORY_UPDATED",
        actor: toAdminOperationActor(admin),
        metadata: { changedFields: Object.keys(body), slug: category.slug },
        requestContext: toAdminOperationRequestContext(request),
        resourceId: category.id,
        resourceType: "article_category",
      });
      return toResponse(category);
    } catch (error) {
      throw mapCategoryError(error);
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @CurrentAdmin() admin: AuthUser, @Req() request: Request) {
    try {
      await this.deleteCategory.execute(id);
      await this.recordAdminOperation.execute({
        action: "ARTICLE_CATEGORY_DELETED",
        actor: toAdminOperationActor(admin),
        requestContext: toAdminOperationRequestContext(request),
        resourceId: id,
        resourceType: "article_category",
      });
    } catch (error) {
      throw mapCategoryError(error);
    }
  }
}

function toResponse(category: AdminArticleCategory): AdminArticleCategoryResponse {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function mapCategoryError(error: unknown) {
  if (error instanceof AdminArticleCategoryNotFoundError) {
    return new NotFoundException({
      error: { code: "ADMIN_ARTICLE_CATEGORY_NOT_FOUND", message: error.message },
    });
  }

  if (error instanceof AdminArticleCategoryConflictError) {
    return new ConflictException({
      error: { code: "ADMIN_ARTICLE_CATEGORY_CONFLICT", message: error.message },
    });
  }

  if (error instanceof AdminArticleCategoryInUseError) {
    return new ConflictException({
      error: { code: "ADMIN_ARTICLE_CATEGORY_IN_USE", message: error.message },
    });
  }

  if (error instanceof AdminArticleCategoryValidationError) {
    return new BadRequestException({
      error: { code: "ADMIN_ARTICLE_CATEGORY_VALIDATION_FAILED", message: error.message },
    });
  }

  return error;
}

export { AdminArticleCategoriesController };
