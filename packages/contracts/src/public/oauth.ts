import type { AdminUserResponse } from "../admin/auth.js";

type OAuthScope = "articles:read" | "articles:write" | "admin:read" | "admin:write";

type OAuthDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

type OAuthConsentResponse = {
  clientName: string;
  userCode: string;
  scopes: OAuthScope[];
};

type OAuthAuthorizationDecisionRequest = {
  user_code: string;
  decision: "allow" | "deny";
};

type OAuthAuthorizationDecisionResponse = { status: "approved" | "denied" };

type OAuthTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

type OAuthMeResponse = {
  user: AdminUserResponse;
  scope: string;
  expiresAt: string;
};

export type {
  OAuthScope,
  OAuthDeviceCodeResponse,
  OAuthConsentResponse,
  OAuthAuthorizationDecisionRequest,
  OAuthAuthorizationDecisionResponse,
  OAuthTokenResponse,
  OAuthMeResponse,
};
