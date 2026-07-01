import type { GithubUserProfile } from "./auth-user.entity";

type GithubAuthorizationRequest = {
  codeVerifier: string;
  returnTo: string;
  state: string;
  url: string;
};

interface GithubOAuthClient {
  createAuthorizationRequest(returnTo: string): GithubAuthorizationRequest;
  getFrontendOrigin(): string;
  getUserProfile(input: { code: string; codeVerifier: string }): Promise<GithubUserProfile>;
}

const GITHUB_OAUTH_CLIENT = Symbol("GITHUB_OAUTH_CLIENT");

export { GITHUB_OAUTH_CLIENT, type GithubAuthorizationRequest, type GithubOAuthClient };
