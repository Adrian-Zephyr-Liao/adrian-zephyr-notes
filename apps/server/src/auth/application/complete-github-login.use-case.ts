import { Inject, Injectable } from "@nestjs/common";
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from "../domain/auth-session.repository";
import { AUTH_USER_REPOSITORY, type AuthUserRepository } from "../domain/auth-user.repository";
import { GITHUB_OAUTH_CLIENT, type GithubOAuthClient } from "../domain/github-oauth-client";

@Injectable()
class CompleteGithubLoginUseCase {
  constructor(
    @Inject(GITHUB_OAUTH_CLIENT)
    private readonly githubOAuthClient: GithubOAuthClient,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  async execute(input: { code: string; codeVerifier: string }) {
    const profile = await this.githubOAuthClient.getUserProfile(input);
    const user = await this.authUserRepository.upsertGithubUser(profile);
    const session = await this.authSessionRepository.createSession(user.id);

    return {
      session,
      user,
    };
  }
}

export { CompleteGithubLoginUseCase };
