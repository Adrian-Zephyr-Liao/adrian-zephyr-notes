import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { GithubUserProfile } from "../domain/auth-user.entity";
import type { GithubOAuthClient } from "../domain/github-oauth-client";

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  html_url: string;
};

type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

@Injectable()
class DefaultGithubOAuthClient implements GithubOAuthClient {
  constructor(private readonly configService: ConfigService) {}

  createAuthorizationRequest(returnTo: string) {
    const clientId = this.requireConfig("GITHUB_OAUTH_CLIENT_ID");
    const redirectUri = this.getRedirectUri();
    const state = randomBytes(24).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const url = new URL(GITHUB_AUTHORIZE_URL);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return {
      codeVerifier,
      returnTo: sanitizeReturnTo(returnTo),
      state,
      url: url.toString(),
    };
  }

  getFrontendOrigin() {
    return this.configService.get<string>("FRONTEND_ORIGIN") ?? "http://localhost:3002";
  }

  async getUserProfile(input: { code: string; codeVerifier: string }): Promise<GithubUserProfile> {
    const token = await this.exchangeCodeForToken(input.code, input.codeVerifier);
    const githubUser = await this.fetchGithubUser(token);
    const email = githubUser.email ?? (await this.fetchPrimaryEmail(token));

    return {
      githubId: String(githubUser.id),
      login: githubUser.login,
      name: githubUser.name,
      email,
      avatarUrl: githubUser.avatar_url,
      profileUrl: githubUser.html_url,
    };
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string) {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.requireConfig("GITHUB_OAUTH_CLIENT_ID"),
        client_secret: this.requireConfig("GITHUB_OAUTH_CLIENT_SECRET"),
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.getRedirectUri(),
      }),
    });

    const payload = (await response.json()) as { access_token?: string; error?: string };

    if (!response.ok || !payload.access_token) {
      throw new Error(`GitHub token exchange failed: ${payload.error ?? response.status}`);
    }

    return payload.access_token;
  }

  private async fetchGithubUser(token: string) {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub user request failed: ${response.status}`);
    }

    return (await response.json()) as GithubUser;
  }

  private async fetchPrimaryEmail(token: string) {
    const response = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return null;
    }

    const emails = (await response.json()) as GithubEmail[];
    return emails.find((email) => email.primary && email.verified)?.email ?? null;
  }

  private getRedirectUri() {
    return (
      this.configService.get<string>("GITHUB_OAUTH_CALLBACK_URL") ??
      "http://localhost:3002/api/auth/github/callback"
    );
  }

  private requireConfig(name: string) {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new Error(`${name} is required for GitHub login.`);
    }

    return value;
  }
}

function sanitizeReturnTo(value: string) {
  if (!value.startsWith("/")) {
    return "/";
  }

  if (value.startsWith("//")) {
    return "/";
  }

  return value;
}

export { DefaultGithubOAuthClient, sanitizeReturnTo };
