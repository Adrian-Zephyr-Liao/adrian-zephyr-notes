import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateAdminArticleUseCase } from "./application/create-admin-article.use-case";
import { DeleteCurrentAdminArticleEditorDraftUseCase } from "./application/delete-current-admin-article-editor-draft.use-case";
import { DeleteAdminArticleUseCase } from "./application/delete-admin-article.use-case";
import { GeneratePendingArticleSummariesUseCase } from "./application/generate-pending-article-summaries.use-case";
import { GetCurrentAdminArticleEditorDraftUseCase } from "./application/get-current-admin-article-editor-draft.use-case";
import { GetAdminArticleByIdUseCase } from "./application/get-admin-article-by-id.use-case";
import { GetPublishedArticleBySlugUseCase } from "./application/get-published-article-by-slug.use-case";
import { ListAdminArticleTaxonomiesUseCase } from "./application/list-admin-article-taxonomies.use-case";
import { ListAdminArticlesUseCase } from "./application/list-admin-articles.use-case";
import { ListPublishedArticlesUseCase } from "./application/list-published-articles.use-case";
import { QueueArticleSummaryUseCase } from "./application/queue-article-summary.use-case";
import { SaveCurrentAdminArticleEditorDraftUseCase } from "./application/save-current-admin-article-editor-draft.use-case";
import { UpdateAdminArticleUseCase } from "./application/update-admin-article.use-case";
import { ADMIN_ARTICLE_EDITOR_DRAFT_REPOSITORY } from "./domain/admin-article-editor-draft.repository";
import { ADMIN_ARTICLE_REPOSITORY } from "./domain/admin-article.repository";
import { ARTICLE_AI_SUMMARY_REPOSITORY } from "./domain/article-ai-summary.repository";
import { ARTICLE_SUMMARY_GENERATOR } from "./domain/article-summary-generator";
import { ARTICLE_REPOSITORY } from "./domain/article.repository";
import { OpenAiCompatibleArticleSummaryGenerator } from "./infrastructure/ai/openai-compatible-article-summary.generator";
import { PrismaAdminArticleEditorDraftRepository } from "./infrastructure/prisma-admin-article-editor-draft.repository";
import { PrismaAdminArticleRepository } from "./infrastructure/prisma-admin-article.repository";
import { PrismaArticleRepository } from "./infrastructure/prisma-article.repository";
import { PrismaArticleAiSummaryRepository } from "./infrastructure/prisma-article-ai-summary.repository";
import { AdminArticleEditorDraftsController } from "./presentation/admin-article-editor-drafts.controller";
import { AdminArticlesController } from "./presentation/admin-articles.controller";
import { ArticlesController } from "./presentation/articles.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [ArticlesController, AdminArticlesController, AdminArticleEditorDraftsController],
  providers: [
    CreateAdminArticleUseCase,
    DeleteCurrentAdminArticleEditorDraftUseCase,
    DeleteAdminArticleUseCase,
    GetAdminArticleByIdUseCase,
    GetCurrentAdminArticleEditorDraftUseCase,
    ListAdminArticlesUseCase,
    ListAdminArticleTaxonomiesUseCase,
    ListPublishedArticlesUseCase,
    UpdateAdminArticleUseCase,
    GetPublishedArticleBySlugUseCase,
    QueueArticleSummaryUseCase,
    SaveCurrentAdminArticleEditorDraftUseCase,
    GeneratePendingArticleSummariesUseCase,
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
})
export class ArticlesModule {}
