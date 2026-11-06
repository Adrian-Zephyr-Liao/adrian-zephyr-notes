import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError, isRecord } from "../core/errors.ts";
type Credentials = { server: string; accessToken: string; expiresAt: string; scope: string };
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

export { credentialsPath, readCredentials, saveCredentials, resolveAuth, serverUrl };
export type { Credentials };
