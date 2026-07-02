import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateArticleCommentUseCase } from "./application/create-article-comment.use-case";
import { LikeArticleCommentUseCase } from "./application/like-article-comment.use-case";
import { ListVisibleArticleCommentsUseCase } from "./application/list-visible-article-comments.use-case";
import { UnlikeArticleCommentUseCase } from "./application/unlike-article-comment.use-case";
import { ARTICLE_COMMENT_LIKE_REPOSITORY } from "./domain/article-comment-like.repository";
import { ARTICLE_COMMENT_REPOSITORY } from "./domain/article-comment.repository";
import { PrismaArticleCommentLikeRepository } from "./infrastructure/prisma-article-comment-like.repository";
import { PrismaArticleCommentRepository } from "./infrastructure/prisma-article-comment.repository";
import { ArticleCommentLikesController } from "./presentation/article-comment-likes.controller";
import { ArticleCommentsController } from "./presentation/article-comments.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ArticleCommentsController, ArticleCommentLikesController],
  providers: [
    CreateArticleCommentUseCase,
    LikeArticleCommentUseCase,
    ListVisibleArticleCommentsUseCase,
    UnlikeArticleCommentUseCase,
    {
      provide: ARTICLE_COMMENT_REPOSITORY,
      useClass: PrismaArticleCommentRepository,
    },
    {
      provide: ARTICLE_COMMENT_LIKE_REPOSITORY,
      useClass: PrismaArticleCommentLikeRepository,
    },
  ],
})
export class CommentsModule {}
