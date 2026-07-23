import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { CreateArticleCommentUseCase } from "./application/create-article-comment.use-case";
import { LikeArticleCommentUseCase } from "./application/like-article-comment.use-case";
import { ListAdminArticleCommentsUseCase } from "./application/list-admin-article-comments.use-case";
import { ListVisibleArticleCommentsUseCase } from "./application/list-visible-article-comments.use-case";
import { UnlikeArticleCommentUseCase } from "./application/unlike-article-comment.use-case";
import { UpdateAdminArticleCommentStatusUseCase } from "./application/update-admin-article-comment-status.use-case";
import { ADMIN_ARTICLE_COMMENT_REPOSITORY } from "./domain/admin-article-comment.repository";
import { ARTICLE_COMMENT_LIKE_REPOSITORY } from "./domain/article-comment-like.repository";
import { ARTICLE_COMMENT_REPOSITORY } from "./domain/article-comment.repository";
import { PrismaAdminArticleCommentRepository } from "./infrastructure/prisma-admin-article-comment.repository";
import { PrismaArticleCommentLikeRepository } from "./infrastructure/prisma-article-comment-like.repository";
import { PrismaArticleCommentRepository } from "./infrastructure/prisma-article-comment.repository";
import { AdminArticleCommentsController } from "./presentation/admin-article-comments.controller";
import { ArticleCommentLikesController } from "./presentation/article-comment-likes.controller";
import { ArticleCommentsController } from "./presentation/article-comments.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [
    ArticleCommentsController,
    ArticleCommentLikesController,
    AdminArticleCommentsController,
  ],
  providers: [
    CreateArticleCommentUseCase,
    LikeArticleCommentUseCase,
    ListAdminArticleCommentsUseCase,
    ListVisibleArticleCommentsUseCase,
    UnlikeArticleCommentUseCase,
    UpdateAdminArticleCommentStatusUseCase,
    {
      provide: ADMIN_ARTICLE_COMMENT_REPOSITORY,
      useClass: PrismaAdminArticleCommentRepository,
    },
    {
      provide: ARTICLE_COMMENT_REPOSITORY,
      useClass: PrismaArticleCommentRepository,
    },
    {
      provide: ARTICLE_COMMENT_LIKE_REPOSITORY,
      useClass: PrismaArticleCommentLikeRepository,
    },
  ],
  exports: [ListAdminArticleCommentsUseCase, UpdateAdminArticleCommentStatusUseCase],
})
export class CommentsModule {}
