import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { OAuthDeviceCodeResponse, OAuthTokenResponse } from "@adrian-zephyr-notes/contracts";

const CLIENT_ID = "azn-cli";
const DEFAULT_SCOPE = "articles:read articles:write";
type Credentials = { server: string; accessToken: string; expiresAt: string; scope: string };

class CliError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function serverUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliError("INVALID_SERVER", "--server must be an absolute API server URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new CliError(
      "INVALID_SERVER",
      "Use an HTTPS server origin (HTTP is allowed on localhost)",
    );
  }
  return url.origin;
}

function credentialsPath() {
  return join(
    process.env.AZN_CONFIG_DIR ??
      join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "azn"),
    "credentials.json",
  );
}

async function readCredentials(): Promise<Credentials | undefined> {
  const path = credentialsPath();
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
      throw new CliError("INVALID_CREDENTIALS", "Credentials must be a private file (chmod 600)");
    }
    const data: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      !isRecord(data) ||
      typeof data.server !== "string" ||
      typeof data.accessToken !== "string" ||
      !/^[A-Za-z0-9_-]{32,256}$/.test(data.accessToken) ||
      typeof data.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(data.expiresAt)) ||
      typeof data.scope !== "string"
    ) {
      throw new Error("Invalid credential data");
    }
    return {
      server: serverUrl(data.server),
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      scope: data.scope,
    };
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    if (error instanceof CliError) throw error;
    throw new CliError(
      "INVALID_CREDENTIALS",
      "Cannot read credentials; run auth login to sign in again",
    );
  }
}

async function saveCredentials(credentials: Credentials) {
  const path = credentialsPath();
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (!(await lstat(directory)).isDirectory()) {
    throw new CliError("INVALID_CONFIG_DIR", "AZN_CONFIG_DIR must be a directory, not a symlink");
  }
  await chmod(directory, 0o700);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(credentials)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function resolveAuth(explicitServer?: string, allowExpired = false) {
  const environmentToken = process.env.AZN_ACCESS_TOKEN;
  // A supplied environment token is usable without a local credential file.
  const saved = environmentToken ? undefined : await readCredentials();
  const selectedServer =
    explicitServer ?? (process.env.AZN_SERVER_URL || undefined) ?? saved?.server;
  if (!selectedServer)
    throw new CliError("AUTH_REQUIRED", "Run auth login --server <API origin> first");
  const server = serverUrl(selectedServer);
  if (saved && saved.server !== server) {
    throw new CliError(
      "SERVER_MISMATCH",
      "Saved credentials belong to a different server; sign in again",
    );
  }
  const token = environmentToken || saved?.accessToken;
  if (!token) throw new CliError("AUTH_REQUIRED", "Run auth login first");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new CliError("INVALID_CREDENTIALS", "Invalid access token");
  }
  if (!allowExpired && saved && Date.parse(saved.expiresAt) <= Date.now()) {
    throw new CliError("AUTH_EXPIRED", "Authorization expired; run auth login again");
  }
  return { server, token, saved };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request<T>(
  server: string,
  path: string,
  init: RequestInit = {},
  emptyResponse = false,
): Promise<T> {
  const uncertainWrite =
    path.startsWith("/api/admin/articles") && init.method && init.method !== "GET"
      ? "; the write outcome may be unknown. Check the article before retrying"
      : "";
  let response: Response;
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  try {
    response = await fetch(`${server}${path}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers,
    });
  } catch {
    throw new CliError("REQUEST_FAILED", `Cannot reach the API server${uncertainWrite}`);
  }
  const data: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : data;
    const code =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : isRecord(error) && typeof error.code === "string"
          ? error.code
          : `HTTP_${response.status}`;
    const message =
      isRecord(error) && typeof error.message === "string"
        ? error.message
        : isRecord(data) && typeof data.error_description === "string"
          ? data.error_description
          : `API request failed (${response.status})`;
    throw new CliError(
      code,
      `${message}${response.status >= 500 ? uncertainWrite : ""}`,
      response.status,
    );
  }
  if (!emptyResponse && response.status !== 204 && data === undefined) {
    throw new CliError(
      "INVALID_RESPONSE",
      `API did not return complete JSON; check the server origin${uncertainWrite}`,
    );
  }
  return data as T;
}

function formRequest(values: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString(),
  };
}

async function login(explicitServer?: string, noBrowser = false, readOnly = false) {
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
  const scope = readOnly ? "articles:read" : DEFAULT_SCOPE;
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
  console.error(
    `Open ${device.verification_uri_complete}\nEnter/verify code: ${device.user_code}\nWaiting for browser approval (you can use another device).`,
  );
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

export { CliError, isRecord, login, logout, request, resolveAuth, serverUrl };
