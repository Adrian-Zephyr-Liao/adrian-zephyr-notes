import type { AuthUser } from "../../auth/domain/auth-user.entity";

const OAUTH_CLIENT_ID = "azn-cli";
const OAUTH_CLIENT_NAME = "AZ Notes CLI";
const OAUTH_SCOPES = ["articles:read", "articles:write"] as const;
const OAUTH_DEVICE_TTL_SECONDS = 600;
const OAUTH_POLL_INTERVAL_SECONDS = 5;
const OAUTH_TOKEN_TTL_SECONDS = 28_800;

type OAuthScope = (typeof OAUTH_SCOPES)[number];
type OAuthDevice = {
  clientId: string;
  scope: string;
  deviceCodeHash: string;
  userCodeHash: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "CONSUMED";
  expiresAt: Date;
};
type OAuthAccessToken = {
  tokenHash: string;
  clientId: string;
  scope: string;
  user: AuthUser;
  expiresAt: Date;
};

class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export {
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_NAME,
  OAUTH_SCOPES,
  OAUTH_DEVICE_TTL_SECONDS,
  OAUTH_POLL_INTERVAL_SECONDS,
  OAUTH_TOKEN_TTL_SECONDS,
  OAuthError,
};
export type { OAuthScope, OAuthDevice, OAuthAccessToken };
