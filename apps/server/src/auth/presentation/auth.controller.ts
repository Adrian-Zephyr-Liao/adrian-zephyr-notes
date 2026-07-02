import { Controller, Get, Inject, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { CompleteGithubLoginUseCase } from "../application/complete-github-login.use-case";
import { CreateGithubAuthorizationUseCase } from "../application/create-github-authorization.use-case";
import { GetCurrentUserUseCase } from "../application/get-current-user.use-case";
import { LogoutUseCase } from "../application/logout.use-case";
import { GITHUB_OAUTH_CLIENT, type GithubOAuthClient } from "../domain/github-oauth-client";
import { toAuthUserResponse } from "../infrastructure/auth-user.mapper";
import { SESSION_COOKIE_NAME, parseCookies, serializeCookie } from "./cookie";
import { getCurrentUserFromRequest, getSessionTokenFromRequest } from "./request-session";

const OAUTH_STATE_COOKIE_NAME = "azn_oauth_state";
const OAUTH_VERIFIER_COOKIE_NAME = "azn_oauth_verifier";
const OAUTH_RETURN_TO_COOKIE_NAME = "azn_oauth_return_to";
const OAUTH_COOKIE_TTL_SECONDS = 60 * 10;

@Controller("api/auth")
class AuthController {
  constructor(
    private readonly createGithubAuthorization: CreateGithubAuthorizationUseCase,
    private readonly completeGithubLogin: CompleteGithubLoginUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    @Inject(GITHUB_OAUTH_CLIENT)
    private readonly githubOAuthClient: GithubOAuthClient,
  ) {}

  @Get("github/start")
  githubStart(@Query("returnTo") returnTo: string | undefined, @Res() response: Response) {
    const authRequest = this.createGithubAuthorization.execute(returnTo ?? "/");

    response.setHeader("Set-Cookie", [
      serializeCookie(OAUTH_STATE_COOKIE_NAME, authRequest.state, {
        maxAgeSeconds: OAUTH_COOKIE_TTL_SECONDS,
      }),
      serializeCookie(OAUTH_VERIFIER_COOKIE_NAME, authRequest.codeVerifier, {
        maxAgeSeconds: OAUTH_COOKIE_TTL_SECONDS,
      }),
      serializeCookie(OAUTH_RETURN_TO_COOKIE_NAME, authRequest.returnTo, {
        maxAgeSeconds: OAUTH_COOKIE_TTL_SECONDS,
      }),
    ]);
    response.redirect(authRequest.url);
  }

  @Get("github/callback")
  async githubCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const cookies = parseCookies(request.headers.cookie);
    const frontendOrigin = this.githubOAuthClient.getFrontendOrigin();
    const returnTo = cookies[OAUTH_RETURN_TO_COOKIE_NAME] ?? "/";

    if (!code || !state || state !== cookies[OAUTH_STATE_COOKIE_NAME]) {
      response.redirect(`${frontendOrigin}${returnTo}?auth=failed`);
      return;
    }

    const { session } = await this.completeGithubLogin.execute({
      code,
      codeVerifier: cookies[OAUTH_VERIFIER_COOKIE_NAME] ?? "",
    });

    response.setHeader("Set-Cookie", [
      serializeCookie(SESSION_COOKIE_NAME, session.token, {
        maxAgeSeconds: session.maxAgeSeconds,
      }),
      clearCookie(OAUTH_STATE_COOKIE_NAME),
      clearCookie(OAUTH_VERIFIER_COOKIE_NAME),
      clearCookie(OAUTH_RETURN_TO_COOKIE_NAME),
    ]);
    response.redirect(`${frontendOrigin}${returnTo}`);
  }

  @Get("me")
  async me(@Req() request: Request) {
    const user = await getCurrentUserFromRequest(request, this.getCurrentUser);

    return {
      user: user ? toAuthUserResponse(user) : null,
    };
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res() response: Response) {
    await this.logoutUseCase.execute(getSessionTokenFromRequest(request));
    response.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE_NAME));
    response.status(204).send();
  }
}

function clearCookie(name: string) {
  return serializeCookie(name, "", {
    maxAgeSeconds: 0,
  });
}

export { AuthController };
