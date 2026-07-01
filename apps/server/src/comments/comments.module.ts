import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateArticleCommentUseCase } from "./application/create-article-comment.use-case";
import { ListVisibleArticleCommentsUseCase } from "./application/list-visible-article-comments.use-case";
import { ARTICLE_COMMENT_REPOSITORY } from "./domain/article-comment.repository";
import { PrismaArticleCommentRepository } from "./infrastructure/prisma-article-comment.repository";
import { ArticleCommentsController } from "./presentation/article-comments.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ArticleCommentsController],
  providers: [
    CreateArticleCommentUseCase,
    ListVisibleArticleCommentsUseCase,
    {
      provide: ARTICLE_COMMENT_REPOSITORY,
      useClass: PrismaArticleCommentRepository,
    },
  ],
})
export class CommentsModule {}
