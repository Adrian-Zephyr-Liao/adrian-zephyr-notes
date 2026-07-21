import {
  BadRequestException,
  Body,
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
  AdminArticleDetailResponse,
  AdminArticleListResponse,
  AdminArticleTaxonomyOptionsResponse,
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
  AdminArticleNotFoundError,
  AdminArticleValidationError,
} from "../application/admin-article.errors";
import { CreateAdminArticleUseCase } from "../application/create-admin-article.use-case";
import { DeleteAdminArticleUseCase } from "../application/delete-admin-article.use-case";
import { GetAdminArticleByIdUseCase } from "../application/get-admin-article-by-id.use-case";
import { ListAdminArticleTaxonomiesUseCase } from "../application/list-admin-article-taxonomies.use-case";
import { ListAdminArticlesUseCase } from "../application/list-admin-articles.use-case";
import { UpdateAdminArticleUseCase } from "../application/update-admin-article.use-case";
import {
  toAdminArticleDetailResponse,
  toAdminArticleListResponse,
  toAdminArticleTaxonomyOptionsResponse,
} from "../infrastructure/admin-article-read-model.mapper";
import { AdminArticleListQueryDto } from "./dto/admin-article-list-query.dto";
import { CreateAdminArticleDto } from "./dto/create-admin-article.dto";
import { UpdateAdminArticleDto } from "./dto/update-admin-article.dto";

@Controller("api/admin/articles")
@UseGuards(AdminAuthGuard)
class AdminArticlesController {
  constructor(
    private readonly createAdminArticle: CreateAdminArticleUseCase,
    private readonly deleteAdminArticle: DeleteAdminArticleUseCase,
    private readonly getAdminArticleById: GetAdminArticleByIdUseCase,
    private readonly listAdminArticleTaxonomies: ListAdminArticleTaxonomiesUseCase,
    private readonly listAdminArticles: ListAdminArticlesUseCase,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateAdminArticle: UpdateAdminArticleUseCase,
  ) {}

  @Get()
  async list(@Query() query: AdminArticleListQueryDto): Promise<AdminArticleListResponse> {
    const result = await this.listAdminArticles.execute({
      page: query.page,
      pageSize: query.pageSize,
      search: query.q,
      status: query.status,
      origin: query.origin,
    });

    return toAdminArticleListResponse(result);
  }

  @Post()
  async create(
    @Body() body: CreateAdminArticleDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleDetailResponse> {
    try {
      const article = await this.createAdminArticle.execute({
        categorySlug: body.categorySlug,
        coverImageUrl: body.coverImageUrl,
        description: body.description,
        markdown: body.markdown,
        origin: body.origin,
        sourceAuthor: body.sourceAuthor,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        status: body.status,
        tagSlugs: body.tagSlugs,
        title: body.title,
      });

      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "ARTICLE_CREATED",
        resourceType: "article",
        resourceId: article.id,
        metadata: {
          articleSlug: article.slug,
          articleTitle: article.title,
          status: article.status,
        },
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminArticleDetailResponse(article);
    } catch (error) {
      throw mapAdminArticleError(error);
    }
  }

  @Get("taxonomies")
  async taxonomies(): Promise<AdminArticleTaxonomyOptionsResponse> {
    const result = await this.listAdminArticleTaxonomies.execute();
    return toAdminArticleTaxonomyOptionsResponse(result);
  }

  @Get(":id")
  async detail(@Param("id") id: string): Promise<AdminArticleDetailResponse> {
    try {
      const article = await this.getAdminArticleById.execute(id);
      return toAdminArticleDetailResponse(article);
    } catch (error) {
      throw mapAdminArticleError(error);
    }
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAdminArticleDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminArticleDetailResponse> {
    try {
      const article = await this.updateAdminArticle.execute({
        id,
        categorySlug: body.categorySlug,
        coverImageUrl: body.coverImageUrl,
        description: body.description,
        markdown: body.markdown,
        origin: body.origin,
        sourceAuthor: body.sourceAuthor,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        status: body.status,
        tagSlugs: body.tagSlugs,
        title: body.title,
      });

      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "ARTICLE_UPDATED",
        resourceType: "article",
        resourceId: article.id,
        metadata: {
          articleSlug: article.slug,
          articleTitle: article.title,
          changedFields: toChangedFields(body),
          status: article.status,
        },
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminArticleDetailResponse(article);
    } catch (error) {
      throw mapAdminArticleError(error);
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @CurrentAdmin() admin: AuthUser, @Req() request: Request) {
    try {
      const article = await this.getAdminArticleById.execute(id);

      await this.deleteAdminArticle.execute(id);
      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "ARTICLE_DELETED",
        resourceType: "article",
        resourceId: article.id,
        metadata: {
          articleSlug: article.slug,
          articleTitle: article.title,
          status: article.status,
        },
        requestContext: toAdminOperationRequestContext(request),
      });
    } catch (error) {
      throw mapAdminArticleError(error);
    }
  }
}

function mapAdminArticleError(error: unknown) {
  if (error instanceof AdminArticleNotFoundError) {
    return new NotFoundException({
      error: {
        code: "ADMIN_ARTICLE_NOT_FOUND",
        message: "Article not found",
      },
    });
  }

  if (error instanceof AdminArticleValidationError) {
    return new BadRequestException({
      error: {
        code: "ADMIN_ARTICLE_VALIDATION_FAILED",
        message: error.message,
      },
    });
  }

  return error;
}

function toChangedFields(body: UpdateAdminArticleDto) {
  return Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field)
    .filter((field) => field !== "markdown");
}

export { AdminArticlesController };
