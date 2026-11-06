import { OAUTH_CLIENT_ID, OAUTH_SCOPES, OAuthError } from "../domain/oauth";

function parameters(value: unknown, fields: string[]): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => Object.hasOwn(value, field)) ||
    Object.values(value).some((field) => typeof field !== "string" || field.length > 2048)
  ) {
    throw new OAuthError("invalid_request", "Expected the documented string parameters.");
  }
  return value as Record<string, string>;
}

function requireClient(clientId: string) {
  if (clientId !== OAUTH_CLIENT_ID) {
    throw new OAuthError("invalid_client", "Unknown OAuth client.");
  }
  return clientId;
}

function parseScope(scope: string) {
  const values = scope.split(" ");
  if (!values.length || values.some((value) => !OAUTH_SCOPES.some((scope) => scope === value))) {
    throw new OAuthError("invalid_scope", "Use the documented administrator or article scopes.");
  }
  return OAUTH_SCOPES.filter((value) => values.includes(value)).join(" ");
}

function parseUserCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/.test(code)) {
    throw new OAuthError("invalid_request", "Enter the eight-character device authorization code.");
  }
  const compact = code.replace("-", "");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function requireDeviceCode(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new OAuthError("invalid_grant", "The device authorization code is invalid or expired.");
  }
  return value;
}

export { parameters, requireClient, parseScope, parseUserCode, requireDeviceCode };
