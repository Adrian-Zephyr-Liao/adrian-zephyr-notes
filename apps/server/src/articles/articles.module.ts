import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { GeneratePendingArticleSummariesUseCase } from "./application/generate-pending-article-summaries.use-case";
import { GetPublishedArticleBySlugUseCase } from "./application/get-published-article-by-slug.use-case";
import { ListPublishedArticlesUseCase } from "./application/list-published-articles.use-case";
import { QueueArticleSummaryUseCase } from "./application/queue-article-summary.use-case";
import { ARTICLE_AI_SUMMARY_REPOSITORY } from "./domain/article-ai-summary.repository";
import { ARTICLE_SUMMARY_GENERATOR } from "./domain/article-summary-generator";
import { ARTICLE_REPOSITORY } from "./domain/article.repository";
import { OpenAiCompatibleArticleSummaryGenerator } from "./infrastructure/ai/openai-compatible-article-summary.generator";
import { PrismaArticleRepository } from "./infrastructure/prisma-article.repository";
import { PrismaArticleAiSummaryRepository } from "./infrastructure/prisma-article-ai-summary.repository";
import { ArticlesController } from "./presentation/articles.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ArticlesController],
  providers: [
    ListPublishedArticlesUseCase,
    GetPublishedArticleBySlugUseCase,
    QueueArticleSummaryUseCase,
    GeneratePendingArticleSummariesUseCase,
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
