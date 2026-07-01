import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { GetPublishedArticleBySlugUseCase } from "./application/get-published-article-by-slug.use-case";
import { ListPublishedArticlesUseCase } from "./application/list-published-articles.use-case";
import { ARTICLE_REPOSITORY } from "./domain/article.repository";
import { PrismaArticleRepository } from "./infrastructure/prisma-article.repository";
import { ArticlesController } from "./presentation/articles.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ArticlesController],
  providers: [
    ListPublishedArticlesUseCase,
    GetPublishedArticleBySlugUseCase,
    {
      provide: ARTICLE_REPOSITORY,
      useClass: PrismaArticleRepository,
    },
  ],
})
export class ArticlesModule {}
