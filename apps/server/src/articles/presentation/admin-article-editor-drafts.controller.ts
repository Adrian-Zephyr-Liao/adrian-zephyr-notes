import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { AdminArticleEditorDraftResponse } from "@adrian-zephyr-notes/contracts";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { DeleteCurrentAdminArticleEditorDraftUseCase } from "../application/delete-current-admin-article-editor-draft.use-case";
import { GetCurrentAdminArticleEditorDraftUseCase } from "../application/get-current-admin-article-editor-draft.use-case";
import { SaveCurrentAdminArticleEditorDraftUseCase } from "../application/save-current-admin-article-editor-draft.use-case";
import {
  AdminArticleNotFoundError,
  AdminArticleValidationError,
} from "../application/admin-article.errors";
import { toAdminArticleEditorDraftResponse } from "../infrastructure/admin-article-editor-draft.mapper";
import { AdminArticleEditorDraftQueryDto } from "./dto/admin-article-editor-draft-query.dto";
import { SaveAdminArticleEditorDraftDto } from "./dto/save-admin-article-editor-draft.dto";

@Controller("api/admin/article-drafts")
@UseGuards(AdminAuthGuard)
class AdminArticleEditorDraftsController {
  constructor(
    private readonly deleteCurrentDraft: DeleteCurrentAdminArticleEditorDraftUseCase,
    private readonly getCurrentDraft: GetCurrentAdminArticleEditorDraftUseCase,
    private readonly saveCurrentDraft: SaveCurrentAdminArticleEditorDraftUseCase,
  ) {}

  @Get("current")
  async current(
    @Query() query: AdminArticleEditorDraftQueryDto,
    @CurrentAdmin() admin: AuthUser,
  ): Promise<AdminArticleEditorDraftResponse | null> {
    const draft = await this.getCurrentDraft.execute({
      ownerUserId: admin.id,
      articleId: query.articleId,
    });

    return draft ? toAdminArticleEditorDraftResponse(draft) : null;
  }

  @Put("current")
  async save(
    @Body() body: SaveAdminArticleEditorDraftDto,
    @CurrentAdmin() admin: AuthUser,
  ): Promise<AdminArticleEditorDraftResponse> {
    try {
      const draft = await this.saveCurrentDraft.execute({
        ownerUserId: admin.id,
        articleId: body.articleId,
        baseArticleUpdatedAt: body.baseArticleUpdatedAt,
        clientSavedAt: body.clientSavedAt,
        values: body.values,
      });

      return toAdminArticleEditorDraftResponse(draft);
    } catch (error) {
      throw mapAdminArticleEditorDraftError(error);
    }
  }

  @Delete("current")
  @HttpCode(204)
  async delete(@Query() query: AdminArticleEditorDraftQueryDto, @CurrentAdmin() admin: AuthUser) {
    await this.deleteCurrentDraft.execute({
      ownerUserId: admin.id,
      articleId: query.articleId,
    });
  }
}

function mapAdminArticleEditorDraftError(error: unknown) {
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
        code: "ADMIN_ARTICLE_DRAFT_VALIDATION_FAILED",
        message: error.message,
      },
    });
  }

  return error;
}

export { AdminArticleEditorDraftsController };
