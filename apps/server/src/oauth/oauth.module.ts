import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminAuthController } from "../auth/presentation/admin-auth.controller";
import { PrismaModule } from "../database/prisma.module";
import { OAuthService } from "./application/oauth.service";
import { OAUTH_REPOSITORY } from "./domain/oauth.repository";
import { PrismaOAuthRepository } from "./infrastructure/prisma-oauth.repository";
import { AdminApiAccessGuard } from "./presentation/admin-api-access.guard";
import { OAuthController } from "./presentation/oauth.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OAuthController, AdminAuthController],
  providers: [
    OAuthService,
    AdminApiAccessGuard,
    { provide: OAUTH_REPOSITORY, useClass: PrismaOAuthRepository },
  ],
  exports: [AdminApiAccessGuard, OAuthService],
})
class OAuthModule {}

export { OAuthModule };
