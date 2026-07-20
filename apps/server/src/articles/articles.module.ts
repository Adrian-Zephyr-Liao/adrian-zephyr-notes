import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateAdminArticleUseCase } from "./application/create-admin-article.use-case";
import {
  CreateAdminArticleCategoryUseCase,
  DeleteAdminArticleCategoryUseCase,
  ListAdminArticleCategoriesUseCase,
  UpdateAdminArticleCategoryUseCase,
} from "./application/admin-article-category.use-cases";
import { DeleteCurrentAdminArticleEditorDraftUseCase } from "./application/delete-current-admin-article-editor-draft.use-case";
import { DeleteAdminArticleUseCase } from "./application/delete-admin-article.use-case";
import { GeneratePendingArticleSummariesUseCase } from "./application/generate-pending-article-summaries.use-case";
import { GetCurrentAdminArticleEditorDraftUseCase } from "./application/get-current-admin-article-editor-draft.use-case";
import { GetAdminArticleByIdUseCase } from "./application/get-admin-article-by-id.use-case";
import { GetPublishedArticleBySlugUseCase } from "./application/get-published-article-by-slug.use-case";
import { GetPublishedArticleCategoryUseCase } from "./application/get-published-article-category.use-case";
import { ListAdminArticleTaxonomiesUseCase } from "./application/list-admin-article-taxonomies.use-case";
import { ListAdminArticlesUseCase } from "./application/list-admin-articles.use-case";
import { ListPublishedArticlesUseCase } from "./application/list-published-articles.use-case";
import { ListPublishedArticleCategoriesUseCase } from "./application/list-published-article-categories.use-case";
import { QueueArticleSummaryUseCase } from "./application/queue-article-summary.use-case";
import {
  GetPublishedArticleTagUseCase,
  ListPublishedArticleTagsUseCase,
} from "./application/published-article-tags.use-cases";
import { SaveCurrentAdminArticleEditorDraftUseCase } from "./application/save-current-admin-article-editor-draft.use-case";
import { UpdateAdminArticleUseCase } from "./application/update-admin-article.use-case";
import { UploadAdminArticleImageUseCase } from "./application/upload-admin-article-image.use-case";
import {
  CreateAdminArticleTagUseCase,
  DeleteAdminArticleTagUseCase,
  ListAdminArticleTagsUseCase,
  MergeAdminArticleTagUseCase,
  UpdateAdminArticleTagUseCase,
} from "./application/admin-article-tag.use-cases";
import { ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY } from "./domain/admin-article-editor-draft.repository";
import { ADMIN_ARTICLE_CATEGORY_REPOSITORY } from "./domain/admin-article-category.repository";
import { ADMIN_ARTICLE_REPOSITORY } from "./domain/admin-article.repository";
import { ADMIN_ARTICLE_TAG_REPOSITORY } from "./domain/admin-article-tag.repository";
import { ARTICLE_AI_SUMMARY_REPOSITORY } from "./domain/article-ai-summary.repository";
import { ARTICLE_SUMMARY_GENERATOR } from "./domain/article-summary-generator";
import { ARTICLE_REPOSITORY } from "./domain/article.repository";
import { ARTICLE_IMAGE_STORAGE } from "./domain/article-image-storage";
import { OpenAiCompatibleArticleSummaryGenerator } from "./infrastructure/ai/openai-compatible-article-summary.generator";
import { PrismaAdminArticleEditorDraftRepository } from "./infrastructure/prisma-admin-article-editor-draft.repository";
import { PrismaAdminArticleCategoryRepository } from "./infrastructure/prisma-admin-article-category.repository";
import { PrismaAdminArticleRepository } from "./infrastructure/prisma-admin-article.repository";
import { PrismaAdminArticleTagRepository } from "./infrastructure/prisma-admin-article-tag.repository";
import { PrismaArticleRepository } from "./infrastructure/prisma-article.repository";
import { PrismaArticleAiSummaryRepository } from "./infrastructure/prisma-article-ai-summary.repository";
import {
  ARTICLE_IMAGE_OSS_CLIENT_FACTORY,
  AliyunOssArticleImageStorage,
  createAliyunOssClient,
} from "./infrastructure/aliyun-oss-article-image.storage";
import { AdminArticleImagesController } from "./presentation/admin-article-images.controller";
import { AdminArticleEditorDraftsController } from "./presentation/admin-article-editor-drafts.controller";
import { AdminArticleCategoriesController } from "./presentation/admin-article-categories.controller";
import { AdminArticlesController } from "./presentation/admin-articles.controller";
import { AdminArticleTagsController } from "./presentation/admin-article-tags.controller";
import { ArticlesController } from "./presentation/articles.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [
    ArticlesController,
    AdminArticlesController,
    AdminArticleImagesController,
    AdminArticleCategoriesController,
    AdminArticleTagsController,
    AdminArticleEditorDraftsController,
  ],
  providers: [
    CreateAdminArticleUseCase,
    CreateAdminArticleCategoryUseCase,
    CreateAdminArticleTagUseCase,
    DeleteAdminArticleCategoryUseCase,
    DeleteCurrentAdminArticleEditorDraftUseCase,
    DeleteAdminArticleUseCase,
    DeleteAdminArticleTagUseCase,
    GetAdminArticleByIdUseCase,
    GetCurrentAdminArticleEditorDraftUseCase,
    GetPublishedArticleCategoryUseCase,
    GetPublishedArticleTagUseCase,
    ListAdminArticlesUseCase,
    ListAdminArticleCategoriesUseCase,
    ListAdminArticleTaxonomiesUseCase,
    ListAdminArticleTagsUseCase,
    ListPublishedArticlesUseCase,
    ListPublishedArticleCategoriesUseCase,
    ListPublishedArticleTagsUseCase,
    MergeAdminArticleTagUseCase,
    UpdateAdminArticleUseCase,
    UpdateAdminArticleCategoryUseCase,
    UpdateAdminArticleTagUseCase,
    UploadAdminArticleImageUseCase,
    GetPublishedArticleBySlugUseCase,
    QueueArticleSummaryUseCase,
    SaveCurrentAdminArticleEditorDraftUseCase,
    GeneratePendingArticleSummariesUseCase,
    AliyunOssArticleImageStorage,
    {
      provide: ARTICLE_IMAGE_OSS_CLIENT_FACTORY,
      useValue: createAliyunOssClient,
    },
    {
      provide: ARTICLE_IMAGE_STORAGE,
      useExisting: AliyunOssArticleImageStorage,
    },
    {
      provide: ADMIN_ARTICLE_CATEGORY_REPOSITORY,
      useClass: PrismaAdminArticleCategoryRepository,
    },
    {
      provide: ADMIN_ARTICLE_TAG_REPOSITORY,
      useClass: PrismaAdminArticleTagRepository,
    },
    {
      provide: ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY,
      useClass: PrismaAdminArticleEditorDraftRepository,
    },
    {
      provide: ADMIN_ARTICLE_REPOSITORY,
      useClass: PrismaAdminArticleRepository,
    },
    {
      provide: ARTICLE_REPOSITORY,
      useClass: PrismaArticleRepository,
    },
    {
      provide: ARTICLE_AI_SUMMARY_REPOSITORY,
      useClass: PrismaArticleAiSummaryRepository,
    },
    {
      provide: ARTICLE_SUMMARY_GENERATOR,
      useClass: OpenAiCompatibleArticleSummaryGenerator,
    },
  ],
  exports: [GetAdminArticleByIdUseCase, ListAdminArticlesUseCase],
})
export class ArticlesModule {}
