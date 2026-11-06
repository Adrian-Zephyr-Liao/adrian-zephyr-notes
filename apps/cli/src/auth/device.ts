import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import type { OAuthDeviceCodeResponse, OAuthTokenResponse } from "@adrian-zephyr-notes/contracts";
import { CliError } from "../core/errors.ts";
import { request } from "../core/http.ts";
import { showDeviceAuthorization } from "../core/output.ts";
import {
  credentialsPath,
  readCredentials,
  resolveAuth,
  saveCredentials,
  serverUrl,
  type Credentials,
} from "./credentials.ts";
const CLIENT_ID = "azn-cli";
const DEFAULT_SCOPE = "admin:read admin:write";
function formRequest(values: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString(),
  };
}

async function login(
  explicitServer?: string,
  noBrowser = false,
  readOnly = false,
  explicitScope?: string,
) {
  const saved = await readCredentials().catch((error: unknown) => {
    if (error instanceof CliError) return undefined;
    throw error;
  });
  const server = serverUrl(
    explicitServer ??
      (process.env.AZN_SERVER_URL || undefined) ??
      saved?.server ??
      "http://localhost:3001",
  );
  if (readOnly && explicitScope)
    throw new CliError("INVALID_ARGUMENT", "Use either --read-only or --scope");
  const scope = explicitScope ?? (readOnly ? "admin:read" : DEFAULT_SCOPE);
  const scopes = scope.split(" ");
  if (
    !scope ||
    scopes.some(
      (item) => !["articles:read", "articles:write", "admin:read", "admin:write"].includes(item),
    ) ||
    new Set(scopes).size !== scopes.length
  ) {
    throw new CliError(
      "INVALID_ARGUMENT",
      "--scope must contain distinct supported scopes separated by spaces",
    );
  }
  const startedAt = Date.now();
  const device = await request<OAuthDeviceCodeResponse>(
    server,
    "/api/oauth/device/code",
    formRequest({ client_id: CLIENT_ID, scope }),
  );
  if (
    typeof device.device_code !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(device.device_code) ||
    typeof device.user_code !== "string" ||
    !/^[A-Z0-9-]{8,20}$/.test(device.user_code) ||
    !Number.isInteger(device.interval) ||
    device.interval < 1 ||
    device.interval > 60 ||
    !Number.isInteger(device.expires_in) ||
    device.expires_in < 1 ||
    device.expires_in > 3600
  ) {
    throw new CliError("INVALID_RESPONSE", "API returned an invalid device authorization response");
  }
  const verificationUrl = serverUrl(new URL(device.verification_uri).origin);
  if (
    verificationUrl !== new URL(device.verification_uri_complete).origin ||
    new URL(device.verification_uri_complete).protocol !== new URL(device.verification_uri).protocol
  ) {
    throw new CliError("INVALID_RESPONSE", "Device verification URLs must share a secure origin");
  }
  showDeviceAuthorization(device.verification_uri_complete, device.user_code);
  if (!noBrowser && process.stderr.isTTY && !process.env.SSH_CONNECTION && !process.env.SSH_TTY) {
    openBrowser(device.verification_uri_complete);
  }
  let interval = device.interval * 1000;
  const deadline = startedAt + device.expires_in * 1000;
  while (Date.now() + interval < deadline) {
    await sleep(interval);
    const issuedAt = Date.now();
    let token: OAuthTokenResponse;
    try {
      token = await request<OAuthTokenResponse>(
        server,
        "/api/oauth/token",
        formRequest({
          client_id: CLIENT_ID,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: device.device_code,
        }),
      );
    } catch (error) {
      if (error instanceof CliError && error.code === "authorization_pending") continue;
      if (error instanceof CliError && error.code === "slow_down") {
        interval += 5000;
        continue;
      }
      throw error;
    }
    if (
      typeof token.access_token !== "string" ||
      !/^[A-Za-z0-9_-]{32,256}$/.test(token.access_token) ||
      token.token_type !== "Bearer" ||
      !Number.isInteger(token.expires_in) ||
      token.expires_in < 1 ||
      token.expires_in > 28800 ||
      typeof token.scope !== "string" ||
      token.scope.split(" ").some((item) => !scope.split(" ").includes(item))
    ) {
      throw new CliError("INVALID_RESPONSE", "API returned an invalid access token response");
    }
    const credentials: Credentials = {
      server,
      accessToken: token.access_token,
      scope: token.scope,
      expiresAt: new Date(issuedAt + token.expires_in * 1000).toISOString(),
    };
    await saveCredentials(credentials);
    return {
      authenticated: true,
      server,
      scope: credentials.scope,
      expiresAt: credentials.expiresAt,
    };
  }
  throw new CliError("expired_token", "Device authorization expired; run auth login again");
}

function openBrowser(url: string) {
  // Pass URLs as arguments, never interpolate a device URL into a shell command.
  if (process.platform === "win32") return;
  const child = spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () => console.error("Open the verification URL above in your browser."));
  child.unref();
}

async function logout(explicitServer?: string) {
  const auth = await resolveAuth(explicitServer, true);
  await request(
    auth.server,
    "/api/oauth/revoke",
    formRequest({ client_id: CLIENT_ID, token: auth.token }),
    true,
  );
  if (auth.saved) await rm(credentialsPath(), { force: true });
  return { authenticated: false, revoked: true };
}

export { login, logout };
