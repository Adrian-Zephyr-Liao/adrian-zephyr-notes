import type { AuthUser } from "../../auth/domain/auth-user.entity";
import type { OAuthAccessToken, OAuthDevice } from "./oauth";

type DeviceExchangeResult =
  | { status: "issued"; scope: string }
  | {
      status:
        | "authorization_pending"
        | "slow_down"
        | "access_denied"
        | "expired_token"
        | "invalid_grant";
    };

interface OAuthRepository {
  createDevice(input: Omit<OAuthDevice, "status"> & { intervalSeconds: number }): Promise<void>;
  findDevice(userCodeHash: string): Promise<OAuthDevice | null>;
  decideDevice(userCodeHash: string, userId: string, allow: boolean): Promise<boolean>;
  exchangeDevice(
    clientId: string,
    deviceCodeHash: string,
    tokenHash: string,
    tokenTtlSeconds: number,
    canAccess: (user: AuthUser) => boolean,
  ): Promise<DeviceExchangeResult>;
  findToken(tokenHash: string): Promise<OAuthAccessToken | null>;
  revokeToken(clientId: string, tokenHash: string): Promise<void>;
}

const OAUTH_REPOSITORY = Symbol("OAUTH_REPOSITORY");
export { OAUTH_REPOSITORY, type OAuthRepository, type DeviceExchangeResult };
