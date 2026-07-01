import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { CompleteGithubLoginUseCase } from "./application/complete-github-login.use-case";
import { CreateGithubAuthorizationUseCase } from "./application/create-github-authorization.use-case";
import { GetCurrentUserUseCase } from "./application/get-current-user.use-case";
import { LogoutUseCase } from "./application/logout.use-case";
import { AUTH_SESSION_REPOSITORY } from "./domain/auth-session.repository";
import { AUTH_USER_REPOSITORY } from "./domain/auth-user.repository";
import { GITHUB_OAUTH_CLIENT } from "./domain/github-oauth-client";
import { DefaultGithubOAuthClient } from "./infrastructure/github-oauth-client";
import { PrismaAuthSessionRepository } from "./infrastructure/prisma-auth-session.repository";
import { PrismaAuthUserRepository } from "./infrastructure/prisma-auth-user.repository";
import { AuthController } from "./presentation/auth.controller";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    CompleteGithubLoginUseCase,
    CreateGithubAuthorizationUseCase,
    GetCurrentUserUseCase,
    LogoutUseCase,
    {
      provide: GITHUB_OAUTH_CLIENT,
      useClass: DefaultGithubOAuthClient,
    },
    {
      provide: AUTH_USER_REPOSITORY,
      useClass: PrismaAuthUserRepository,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: PrismaAuthSessionRepository,
    },
  ],
  exports: [GetCurrentUserUseCase],
})
export class AuthModule {}
