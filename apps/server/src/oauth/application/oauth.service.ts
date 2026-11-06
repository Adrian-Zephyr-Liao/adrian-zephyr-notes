import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminAccessPolicy } from "../../auth/domain/admin-access-policy";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import {
  OAUTH_DEVICE_TTL_SECONDS,
  OAUTH_POLL_INTERVAL_SECONDS,
  OAUTH_TOKEN_TTL_SECONDS,
  OAuthError,
} from "../domain/oauth";
import { OAUTH_REPOSITORY, type OAuthRepository } from "../domain/oauth.repository";

@Injectable()
class OAuthService {
  constructor(
    @Inject(OAUTH_REPOSITORY) private readonly repository: OAuthRepository,
    private readonly configService: ConfigService,
  ) {}

  async createDevice(clientId: string, scope: string) {
    const deviceCode = randomBytes(32).toString("base64url");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(randomBytes(8), (value) => alphabet[value % alphabet.length]).join("");
    const userCode = `${code.slice(0, 4)}-${code.slice(4)}`;
    await this.repository.createDevice({
      clientId,
      scope,
      deviceCodeHash: hashCredential(deviceCode),
      userCodeHash: hashCredential(code),
      expiresAt: new Date(Date.now() + OAUTH_DEVICE_TTL_SECONDS * 1000),
      intervalSeconds: OAUTH_POLL_INTERVAL_SECONDS,
    });
    return { deviceCode, userCode };
  }

  async consent(userCode: string) {
    const device = await this.repository.findDevice(hashCredential(userCode.replace("-", "")));
    if (!device || device.expiresAt.getTime() <= Date.now() || device.status !== "PENDING") {
      throw new OAuthError("invalid_grant", "The device authorization code is invalid or expired.");
    }
    return device.scope;
  }

  async authorize(userCode: string, user: AuthUser, allow: boolean) {
    this.requireAdmin(user);
    const decided = await this.repository.decideDevice(
      hashCredential(userCode.replace("-", "")),
      user.id,
      allow,
    );
    if (!decided) {
      throw new OAuthError("invalid_grant", "The device authorization code is invalid or expired.");
    }
    return { status: allow ? ("approved" as const) : ("denied" as const) };
  }

  async exchange(clientId: string, deviceCode: string) {
    const accessToken = randomBytes(32).toString("base64url");
    const result = await this.repository.exchangeDevice(
      clientId,
      hashCredential(deviceCode),
      hashCredential(accessToken),
      OAUTH_TOKEN_TTL_SECONDS,
      (user) => this.adminPolicy().canAccess(user),
    );
    if (result.status !== "issued") {
      throw new OAuthError(
        result.status,
        "The device authorization is not available for exchange.",
      );
    }
    return {
      access_token: accessToken,
      token_type: "Bearer" as const,
      expires_in: OAUTH_TOKEN_TTL_SECONDS,
      scope: result.scope,
    };
  }

  async authenticate(accessToken: string) {
    const token = await this.repository.findToken(hashCredential(accessToken));
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      throw new OAuthError("invalid_token", "The access token is invalid or expired.");
    }
    this.requireAdmin(token.user);
    return token;
  }

  revoke(clientId: string, token: string) {
    return this.repository.revokeToken(clientId, hashCredential(token));
  }

  private requireAdmin(user: AuthUser) {
    if (!this.adminPolicy().canAccess(user)) {
      throw new OAuthError("access_denied", "Administrator access is required.");
    }
  }

  private adminPolicy() {
    return new AdminAccessPolicy(this.configService.get<string>("ADMIN_GITHUB_LOGINS"));
  }
}

function hashCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export { OAuthService, hashCredential };
