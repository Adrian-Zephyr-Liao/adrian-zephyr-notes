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
  it("keeps a valid session usable when another cookie has malformed encoding", async () => {
    const controller = createController();
    const user = {
      id: "user-1",
      githubId: "123",
      login: "reader",
      name: null,
      avatarUrl: null,
      profileUrl: "https://github.com/reader",
    };
    controller.getCurrentUser.execute.mockResolvedValue(user);

    await expect(
      controller.authController.me(
        createRequestDouble("analytics=%E0%A4%A; azn_session=encoded%2Ftoken; theme=%"),
      ),
    ).resolves.toEqual({ user });
    expect(controller.getCurrentUser.execute).toHaveBeenCalledWith("encoded/token");
  });

  it("treats a malformed session cookie as absent instead of failing the request", async () => {
    const controller = createController();
    controller.getCurrentUser.execute.mockResolvedValue(null);

    await expect(
      controller.authController.me(createRequestDouble("azn_session=%E0%A4%A")),
    ).resolves.toEqual({ user: null });
    expect(controller.getCurrentUser.execute).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ["mismatched", "expected", "actual"],
    ["malformed", "%E0%A4%A", "%E0%A4%A"],
  ])("rejects GitHub callbacks with a %s state cookie", async (_label, cookieState, state) => {
    const controller = createController();
    const response = createResponseDouble();
    const request = createRequestDouble(
      `azn_oauth_state=${cookieState}; azn_oauth_return_to=%2Fposts%2F5f7448b7`,
    );

    await controller.authController.githubCallback("code", state, request, response);

    expect(controller.completeGithubLogin.execute).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3002/posts/5f7448b7?auth=failed",
    );
  });

  it("creates a local session cookie after a valid GitHub callback", async () => {
    const controller = createController();
    const response = createResponseDouble();
    const request = createRequestDouble(
      "analytics=%; azn_oauth_state=state; azn_oauth_verifier=verifier; azn_oauth_return_to=%2Fposts%2F5f7448b7",
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
  } as unknown as GetCurrentUserUseCase & { execute: ReturnType<typeof vi.fn> };
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
    getCurrentUser,
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
