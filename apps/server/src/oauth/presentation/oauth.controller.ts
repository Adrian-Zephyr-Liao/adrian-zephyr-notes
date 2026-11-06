import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  OAuthAuthorizationDecisionResponse,
  OAuthConsentResponse,
  OAuthDeviceCodeResponse,
  OAuthMeResponse,
  OAuthScope,
  OAuthTokenResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Request, Response } from "express";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { toAdminUserResponse } from "../../auth/infrastructure/auth-user.mapper";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import { OAuthService } from "../application/oauth.service";
import {
  OAUTH_CLIENT_NAME,
  OAUTH_DEVICE_TTL_SECONDS,
  OAUTH_POLL_INTERVAL_SECONDS,
  OAuthError,
} from "../domain/oauth";
import { bearerHttpError, bearerToken, noStore, oauthHttpError } from "./oauth-http";
import {
  parameters,
  parseScope,
  parseUserCode,
  requireClient,
  requireDeviceCode,
} from "./oauth-input";

@Controller("api/oauth")
class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post("device/code")
  @HttpCode(200)
  async device(
    @Body() raw: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OAuthDeviceCodeResponse> {
    noStore(response);
    try {
      this.requireForm(request);
      const input = parameters(raw, ["client_id", "scope"]);
      const { deviceCode, userCode } = await this.oauth.createDevice(
        requireClient(input.client_id),
        parseScope(input.scope),
      );
      const verificationUri = new URL("/oauth/device", this.adminOrigin()).toString();
      const complete = new URL(verificationUri);
      complete.searchParams.set("user_code", userCode);
      return {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: complete.toString(),
        expires_in: OAUTH_DEVICE_TTL_SECONDS,
        interval: OAUTH_POLL_INTERVAL_SECONDS,
      };
    } catch (error) {
      throw oauthHttpError(error);
    }
  }

  @Get("consent")
  @UseGuards(AdminAuthGuard)
  async consent(
    @Query() raw: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OAuthConsentResponse> {
    noStore(response);
    try {
      const input = parameters(raw, ["user_code"]);
      const userCode = parseUserCode(input.user_code);
      const scope = await this.oauth.consent(userCode);
      return { clientName: OAUTH_CLIENT_NAME, userCode, scopes: scope.split(" ") as OAuthScope[] };
    } catch (error) {
      throw oauthHttpError(error);
    }
  }

  @Post("authorize")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  async authorize(
    @Body() raw: unknown,
    @Req() request: Request,
    @CurrentAdmin() admin: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OAuthAuthorizationDecisionResponse> {
    noStore(response);
    if (request.headers.origin !== this.adminOrigin()) {
      throw new ForbiddenException({
        error: "access_denied",
        error_description: "A trusted origin is required.",
      });
    }
    try {
      if (!request.is("application/json")) {
        throw new OAuthError("invalid_request", "Use an application/json request body.");
      }
      const input = parameters(raw, ["user_code", "decision"]);
      if (input.decision !== "allow" && input.decision !== "deny") {
        throw new OAuthError("invalid_request", "Choose allow or deny.");
      }
      return await this.oauth.authorize(
        parseUserCode(input.user_code),
        admin,
        input.decision === "allow",
      );
    } catch (error) {
      throw oauthHttpError(error);
    }
  }

  @Post("token")
  @HttpCode(200)
  async token(
    @Body() raw: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OAuthTokenResponse> {
    noStore(response);
    try {
      this.requireForm(request);
      const input = parameters(raw, ["client_id", "grant_type", "device_code"]);
      requireClient(input.client_id);
      if (input.grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
        throw new OAuthError("unsupported_grant_type", "Use the device authorization grant.");
      }
      return await this.oauth.exchange(input.client_id, requireDeviceCode(input.device_code));
    } catch (error) {
      throw oauthHttpError(error);
    }
  }

  @Post("revoke")
  @HttpCode(200)
  async revoke(
    @Body() raw: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    noStore(response);
    try {
      this.requireForm(request);
      const input = parameters(raw, ["client_id", "token"]);
      requireClient(input.client_id);
      if (!input.token) throw new OAuthError("invalid_request", "A token is required.");
      await this.oauth.revoke(input.client_id, input.token);
    } catch (error) {
      throw oauthHttpError(error);
    }
  }

  @Get("me")
  async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OAuthMeResponse> {
    noStore(response);
    try {
      const token = await this.oauth.authenticate(bearerToken(request));
      return {
        user: toAdminUserResponse(token.user),
        scope: token.scope,
        expiresAt: token.expiresAt.toISOString(),
      };
    } catch (error) {
      throw bearerHttpError(error, response);
    }
  }

  private adminOrigin() {
    return new URL(
      this.configService.get<string>("ADMIN_FRONTEND_ORIGIN") ?? "http://localhost:3000",
    ).origin;
  }

  private requireForm(request: Request) {
    if (!request.is("application/x-www-form-urlencoded")) {
      throw new OAuthError(
        "invalid_request",
        "Use an application/x-www-form-urlencoded request body.",
      );
    }
  }
}

export { OAuthController };
