import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { OAuthService } from "./application/oauth.service";
import { OAUTH_REPOSITORY } from "./domain/oauth.repository";
import { PrismaOAuthRepository } from "./infrastructure/prisma-oauth.repository";
import { ArticleAccessGuard } from "./presentation/article-access.guard";
import { OAuthController } from "./presentation/oauth.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OAuthController],
  providers: [
    OAuthService,
    ArticleAccessGuard,
    { provide: OAUTH_REPOSITORY, useClass: PrismaOAuthRepository },
  ],
  exports: [ArticleAccessGuard, OAuthService],
})
class OAuthModule {}

export { OAuthModule };
