import { Inject, Injectable } from "@nestjs/common";
import { GITHUB_OAUTH_CLIENT, type GithubOAuthClient } from "../domain/github-oauth-client";

@Injectable()
class CreateGithubAuthorizationUseCase {
  constructor(
    @Inject(GITHUB_OAUTH_CLIENT)
    private readonly githubOAuthClient: GithubOAuthClient,
  ) {}

  execute(returnTo: string) {
    return this.githubOAuthClient.createAuthorizationRequest(returnTo);
  }
}

export { CreateGithubAuthorizationUseCase };
