import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { CompleteGithubLoginUseCase } from "../application/complete-github-login.use-case";
import type { CreateGithubAuthorizationUseCase } from "../application/create-github-authorization.use-case";
import type { GetCurrentUserUseCase } from "../application/get-current-user.use-case";
import type { LogoutUseCase } from "../application/logout.use-case";
import type { GithubOAuthClient } from "../domain/github-oauth-client";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  it("rejects GitHub callbacks with mismatched state", async () => {
    const controller = createController();
    const response = createResponseDouble();
    const request = createRequestDouble(
      "azn_oauth_state=expected; azn_oauth_return_to=%2Fposts%2F5f7448b7",
    );

    await controller.authController.githubCallback("code", "actual", request, response);

    expect(controller.completeGithubLogin.execute).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3002/posts/5f7448b7?auth=failed",
    );
  });

  it("creates a local session cookie after a valid GitHub callback", async () => {
    const controller = createController();
    const response = createResponseDouble();
    const request = createRequestDouble(
      "azn_oauth_state=state; azn_oauth_verifier=verifier; azn_oauth_return_to=%2Fposts%2F5f7448b7",
    );

    await controller.authController.githubCallback("code", "state", request, response);

    expect(controller.completeGithubLogin.execute).toHaveBeenCalledWith({
      code: "code",
      codeVerifier: "verifier",
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.arrayContaining([expect.stringContaining("azn_session=session-token")]),
    );
    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3002/posts/5f7448b7");
  });

  it("redirects GitHub callbacks back to the configured admin origin", async () => {
    const controller = createController();
    const response = createResponseDouble();
    const request = createRequestDouble(
      "azn_oauth_state=state; azn_oauth_verifier=verifier; azn_oauth_return_to=%2F; azn_oauth_frontend_origin=http%3A%2F%2Flocalhost%3A3000",
    );

    await controller.authController.githubCallback("code", "state", request, response);

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3000/");
  });

  it("sets shared-domain cookies for cross-subdomain admin and website login", async () => {
    const controller = createController();
    const startResponse = createResponseDouble();
    const callbackResponse = createResponseDouble();
    const request = createRequestDouble(
      "azn_oauth_state=state; azn_oauth_verifier=verifier; azn_oauth_return_to=%2F; azn_oauth_frontend_origin=http%3A%2F%2Flocalhost%3A3000",
    );

    controller.authController.githubStart("/", "admin", startResponse);
    await controller.authController.githubCallback("code", "state", request, callbackResponse);

    expect(startResponse.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.arrayContaining([
        expect.stringContaining(
          "azn_oauth_state=state; Max-Age=600; Path=/; SameSite=Lax; Domain=.zephyrai.site",
        ),
      ]),
    );
    expect(callbackResponse.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.arrayContaining([
        expect.stringContaining(
          "azn_session=session-token; Max-Age=2592000; Path=/; SameSite=Lax; Domain=.zephyrai.site",
        ),
        expect.stringContaining(
          "azn_oauth_state=; Max-Age=0; Path=/; SameSite=Lax; Domain=.zephyrai.site",
        ),
      ]),
    );
  });
});

function createController() {
  const createGithubAuthorization = {
    execute: vi.fn(() => ({
      codeVerifier: "verifier",
      returnTo: "/",
      state: "state",
      url: "https://github.com/login/oauth/authorize",
    })),
  } as unknown as CreateGithubAuthorizationUseCase;
  const completeGithubLogin = {
    execute: vi.fn().mockResolvedValue({
      session: {
        token: "session-token",
        maxAgeSeconds: 2_592_000,
      },
      user: {
        id: "3920d52d-2487-4e6a-99b8-7ce7f183d376",
      },
    }),
  } as unknown as CompleteGithubLoginUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
  const getCurrentUser = {
    execute: vi.fn(),
  } as unknown as GetCurrentUserUseCase;
  const logoutUseCase = {
    execute: vi.fn(),
  } as unknown as LogoutUseCase;
  const configValues = new Map([
    ["ADMIN_FRONTEND_ORIGIN", "http://localhost:3000"],
    ["SESSION_COOKIE_DOMAIN", ".zephyrai.site"],
  ]);
  const configService = {
    get: vi.fn((key: string) => configValues.get(key)),
  } as unknown as ConfigService;
  const githubOAuthClient = {
    getFrontendOrigin: vi.fn(() => "http://localhost:3002"),
  } as unknown as GithubOAuthClient;

  return {
    authController: new AuthController(
      createGithubAuthorization,
      completeGithubLogin,
      getCurrentUser,
      logoutUseCase,
      configService,
      githubOAuthClient,
    ),
    completeGithubLogin,
  };
}

function createRequestDouble(cookie: string) {
  return {
    headers: {
      cookie,
    },
  } as Request;
}

function createResponseDouble() {
  return {
    redirect: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    redirect: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}
