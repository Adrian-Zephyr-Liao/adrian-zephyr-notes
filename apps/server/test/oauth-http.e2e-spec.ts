import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import type { OAuthDeviceCodeResponse, OAuthTokenResponse } from "@adrian-zephyr-notes/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAuthSessionRepository } from "../src/auth/infrastructure/prisma-auth-session.repository";
import { hashCredential } from "../src/oauth/application/oauth.service";

const databaseUrl = process.env.ASSISTANT_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("OAuth device flow through compiled HTTP and PostgreSQL", () => {
  const actorId = randomUUID();
  const visitorId = randomUUID();
  const login = `oauth-${actorId}`;
  const visitorLogin = `visitor-${visitorId}`;
  const adminOrigin = "http://localhost:3000";
  const deviceHashes: string[] = [];
  const articleIds: string[] = [];
  let prisma: PrismaService;
  let app: ChildProcess | undefined;
  let baseUrl: string;
  let cookie: string;
  let visitorCookie: string;
  let output = "";

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
    await prisma.user.createMany({
      data: [
        { id: actorId, githubId: login, login, profileUrl: "https://example.test/oauth" },
        {
          id: visitorId,
          githubId: visitorLogin,
          login: visitorLogin,
          profileUrl: "https://example.test/visitor",
        },
      ],
    });
    const sessions = new PrismaAuthSessionRepository(prisma);
    cookie = `azn_session=${(await sessions.createSession(actorId)).token}`;
    visitorCookie = `azn_session=${(await sessions.createSession(visitorId)).token}`;
    const port = await unusedPort();
    baseUrl = `http://127.0.0.1:${port}`;
    app = spawn(process.execPath, [resolve(__dirname, "../dist/main.js")], {
      cwd: resolve(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: String(port),
        ADMIN_GITHUB_LOGINS: login,
        ADMIN_FRONTEND_ORIGIN: adminOrigin,
        ASSISTANT_ENABLED: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [app.stdout, app.stderr]) {
      stream?.setEncoding("utf8").on("data", (chunk: string) => {
        output = (output + chunk).slice(-16000);
      });
    }
    await vi.waitFor(
      async () => {
        if (app?.exitCode !== null) throw new Error(`Compiled server exited: ${output}`);
        expect((await request("/api/admin/auth/me", { headers: { Cookie: cookie } })).status).toBe(
          200,
        );
      },
      { timeout: 15000, interval: 100 },
    );
  }, 30000);

  afterAll(async () => {
    if (app && app.exitCode === null) {
      const exited = once(app, "exit");
      app.kill("SIGTERM");
      const timeout = setTimeout(() => app?.kill("SIGKILL"), 5000);
      try {
        await exited;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!prisma) return;
    try {
      await prisma.oAuthDeviceAuthorization.deleteMany({
        where: { deviceCodeHash: { in: deviceHashes } },
      });
      await prisma.adminOperationLog.deleteMany({
        where: { actorUserId: { in: [actorId, visitorId] } },
      });
      await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: [actorId, visitorId] } } });
    } finally {
      await prisma.$disconnect();
    }
  }, 20000);

  it("validates the public client and scopes without accepting extra, repeated or JSON parameters", async () => {
    for (const body of [
      { client_id: "unknown", scope: "articles:read" },
      { client_id: "azn-cli", scope: "admin:*" },
      { client_id: "azn-cli", scope: "" },
      { client_id: "azn-cli", scope: "articles:read", user_id: actorId },
    ] as Record<string, string>[]) {
      const response = await form("/api/oauth/device/code", body);
      expect(response.status).toBe(400);
    }
    expect(
      (
        await request("/api/oauth/device/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: "azn-cli", scope: "articles:read" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/api/oauth/device/code", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "client_id=azn-cli&client_id=other&scope=articles%3Aread",
        })
      ).status,
    ).toBe(400);
    const wrongGrant = await form("/api/oauth/token", {
      client_id: "azn-cli",
      grant_type: "authorization_code",
      device_code: "x".repeat(43),
    });
    expect(await wrongGrant.json()).toMatchObject({ error: "unsupported_grant_type" });
  });

  it("only previews after cookie admin login and requires an explicit decision from the trusted origin", async () => {
    const grant = await device();
    expect(grant.user_code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(grant.verification_uri).toBe(`${adminOrigin}/oauth/device`);
    expect(new URL(grant.verification_uri_complete).searchParams.get("user_code")).toBe(
      grant.user_code,
    );
    const path = `/api/oauth/consent?user_code=${grant.user_code.toLowerCase()}`;
    expect((await request(path)).status).toBe(401);
    expect((await request(path, { headers: { Cookie: visitorCookie } })).status).toBe(401);
    const preview = await request(path, { headers: { Cookie: cookie } });
    expect(preview.status).toBe(200);
    expect(preview.headers.get("Cache-Control")).toBe("no-store");
    expect(await preview.json()).toEqual({
      clientName: "AZ Notes CLI",
      userCode: grant.user_code,
      scopes: ["articles:read", "articles:write"],
    });
    const stored = await prisma.oAuthDeviceAuthorization.findUniqueOrThrow({
      where: { deviceCodeHash: hashCredential(grant.device_code) },
    });
    expect(stored.status).toBe("PENDING");
    expect(stored.userId).toBeNull();
    expect(stored.userCodeHash).toBe(hashCredential(grant.user_code.replace("-", "")));
    expect(JSON.stringify(stored)).not.toContain(grant.device_code);
    expect(JSON.stringify(stored)).not.toContain(grant.user_code);
    expect((await decide(grant, "allow", "https://evil.test")).status).toBe(403);
    expect((await decide(grant, "allow", null)).status).toBe(403);
    expect((await decide(grant, "allow", adminOrigin, visitorCookie)).status).toBe(401);
    const spoof = await request("/api/oauth/authorize", {
      method: "POST",
      headers: { Cookie: cookie, Origin: adminOrigin, "Content-Type": "application/json" },
      body: JSON.stringify({ user_code: grant.user_code, decision: "allow", userId: visitorId }),
    });
    expect(spoof.status).toBe(400);
    expect(await (await poll(grant)).json()).toMatchObject({ error: "authorization_pending" });
    expect(await (await decide(grant, "allow")).json()).toEqual({ status: "approved" });
    expect(await (await decide(grant, "allow")).json()).toEqual({ status: "approved" });
    expect((await decide(grant, "deny")).status).toBe(400);
  });

  it("enforces the polling interval and slow_down, then exchanges exactly once under concurrent polling", async () => {
    const grant = await device();
    expect(await (await poll(grant)).json()).toMatchObject({ error: "authorization_pending" });
    expect(await (await poll(grant)).json()).toMatchObject({ error: "slow_down" });
    const row = await prisma.oAuthDeviceAuthorization.findUniqueOrThrow({
      where: { deviceCodeHash: hashCredential(grant.device_code) },
    });
    expect(row.intervalSeconds).toBe(10);
    expect(row.nextPollAt!.getTime()).toBeGreaterThan(Date.now());
    expect((await decide(grant, "allow")).status).toBe(200);
    expect(await (await poll(grant)).json()).toMatchObject({ error: "slow_down" });
    await resetPoll(grant);
    const exchanges = await Promise.all([poll(grant), poll(grant)]);
    expect(
      exchanges.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([200, 400]);
    const success = exchanges.find((response) => response.ok)!;
    const token = (await success.json()) as OAuthTokenResponse;
    expect(token).toMatchObject({
      token_type: "Bearer",
      expires_in: 28800,
      scope: "articles:read articles:write",
    });
    expect(success.headers.get("Cache-Control")).toBe("no-store");
    expect(success.headers.get("Pragma")).toBe("no-cache");
    const saved = await prisma.oAuthAccessToken.findUniqueOrThrow({
      where: { tokenHash: hashCredential(token.access_token) },
    });
    expect(saved.userId).toBe(actorId);
    expect(JSON.stringify(saved)).not.toContain(token.access_token);
    const issuedCount = await prisma.oAuthAccessToken.count({ where: { userId: actorId } });
    expect(await (await decide(grant, "allow")).json()).toEqual({ status: "approved" });
    expect((await decide(grant, "deny")).status).toBe(400);
    expect(await (await poll(grant)).json()).toMatchObject({ error: "invalid_grant" });
    await prisma.oAuthDeviceAuthorization.update({
      where: { deviceCodeHash: hashCredential(grant.device_code) },
      data: { expiresAt: new Date(0) },
    });
    expect(await (await decide(grant, "allow")).json()).toEqual({ status: "approved" });
    expect((await decide(grant, "deny")).status).toBe(400);
    expect(await (await poll(grant)).json()).toMatchObject({ error: "expired_token" });
    expect(await prisma.oAuthAccessToken.count({ where: { userId: actorId } })).toBe(issuedCount);
    expect(await (await request("/api/oauth/me", { headers: bearer(token) })).json()).toMatchObject(
      {
        user: { id: actorId, login, role: "ADMIN" },
        scope: token.scope,
      },
    );
  });

  it("keeps denial, expiry, client binding and unknown device codes from issuing tokens", async () => {
    const grant = await device();
    expect(await (await decide(grant, "deny")).json()).toEqual({ status: "denied" });
    expect(await (await poll(grant)).json()).toMatchObject({ error: "access_denied" });
    const issuedCount = await prisma.oAuthAccessToken.count({ where: { userId: actorId } });
    await prisma.oAuthDeviceAuthorization.update({
      where: { deviceCodeHash: hashCredential(grant.device_code) },
      data: { expiresAt: new Date(0) },
    });
    expect(await (await decide(grant, "deny")).json()).toEqual({ status: "denied" });
    expect((await decide(grant, "allow")).status).toBe(400);
    expect(await (await poll(grant)).json()).toMatchObject({ error: "expired_token" });
    expect(await prisma.oAuthAccessToken.count({ where: { userId: actorId } })).toBe(issuedCount);
    const expired = await device();
    await prisma.oAuthDeviceAuthorization.update({
      where: { deviceCodeHash: hashCredential(expired.device_code) },
      data: { expiresAt: new Date(0) },
    });
    expect(await (await poll(expired)).json()).toMatchObject({ error: "expired_token" });
    expect((await decide(expired, "allow")).status).toBe(400);
    expect(
      (
        await request(`/api/oauth/consent?user_code=${expired.user_code}`, {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(400);
    expect(
      await (
        await form("/api/oauth/token", {
          client_id: "other",
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: grant.device_code,
        })
      ).json(),
    ).toMatchObject({ error: "invalid_client" });
    expect(await (await poll({ ...grant, device_code: "x".repeat(43) })).json()).toMatchObject({
      error: "invalid_grant",
    });
  });

  it("scopes article access, preserves cookie login, and denies deletion and unrelated admin APIs", async () => {
    const read = await approvedToken("articles:read");
    expect((await request("/api/admin/articles", { headers: bearer(read) })).status).toBe(200);
    expect(
      (await request("/api/admin/articles/taxonomies", { headers: bearer(read) })).status,
    ).toBe(200);
    const articleInput = {
      title: "OAuth HTTP draft",
      description: "",
      markdown: "# OAuth\n\nA real saved draft.",
    };
    expect(
      (
        await request("/api/admin/articles", {
          method: "POST",
          headers: { ...bearer(read), "Content-Type": "application/json" },
          body: JSON.stringify(articleInput),
        })
      ).status,
    ).toBe(403);
    const write = await approvedToken("articles:write");
    expect((await request("/api/admin/articles", { headers: bearer(write) })).status).toBe(403);
    const created = await request("/api/admin/articles", {
      method: "POST",
      headers: { ...bearer(write), "Content-Type": "application/json" },
      body: JSON.stringify(articleInput),
    });
    expect(created.status).toBe(201);
    const article = (await created.json()) as { id: string };
    articleIds.push(article.id);
    expect(await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).toMatchObject({
      status: "DRAFT",
      markdown: articleInput.markdown,
    });
    const path = `/api/admin/articles/${article.id}`;
    expect((await request(path, { headers: bearer(read) })).status).toBe(200);
    expect(
      (
        await request(path, {
          method: "PATCH",
          headers: { ...bearer(write), "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated through OAuth" }),
        })
      ).status,
    ).toBe(200);
    const denied = await request(path, { method: "DELETE", headers: bearer(write) });
    expect(denied.status).toBe(403);
    expect(await prisma.article.count({ where: { id: article.id } })).toBe(1);
    for (const blocked of [
      "/api/admin/article-tags",
      "/api/admin/site-config",
      "/api/admin/audit/logs",
      "/api/admin/assistant/capabilities",
    ]) {
      expect((await request(blocked, { headers: bearer(write) })).status, blocked).toBe(401);
    }
    const invalid = await request("/api/admin/articles", {
      headers: { Authorization: "Bearer invalid", Cookie: cookie },
    });
    expect(invalid.status).toBe(401);
    expect((await request(path, { headers: { Cookie: cookie } })).status).toBe(200);
    expect((await request(path, { method: "DELETE", headers: { Cookie: cookie } })).status).toBe(
      204,
    );
    expect(await prisma.article.count({ where: { id: article.id } })).toBe(0);
  });

  it("revokes tokens, rejects expiry and administrator removal, and never accepts browser sessions as OAuth tokens", async () => {
    const token = await approvedToken();
    const auth = bearer(token);
    const revoke = () =>
      form("/api/oauth/revoke", { client_id: "azn-cli", token: token.access_token });
    expect((await revoke()).status).toBe(200);
    expect((await request("/api/oauth/me", { headers: auth })).status).toBe(401);
    expect((await revoke()).status).toBe(200);
    const expired = await approvedToken();
    await prisma.oAuthAccessToken.update({
      where: { tokenHash: hashCredential(expired.access_token) },
      data: { expiresAt: new Date(0) },
    });
    expect((await request("/api/admin/articles", { headers: bearer(expired) })).status).toBe(401);
    expect(
      (
        await request("/api/oauth/me", {
          headers: { Authorization: `Bearer ${cookie.split("=")[1]}` },
        })
      ).status,
    ).toBe(401);
    const removed = await approvedToken();
    const pending = await device();
    expect((await decide(pending, "allow")).status).toBe(200);
    try {
      await prisma.user.update({ where: { id: actorId }, data: { login: `${login}-revoked` } });
      expect((await request("/api/admin/articles", { headers: bearer(removed) })).status).toBe(401);
      expect(await (await poll(pending)).json()).toMatchObject({ error: "access_denied" });
    } finally {
      await prisma.user.update({ where: { id: actorId }, data: { login } });
    }
  });

  it("logs in a browserless CLI, saves and publishes an article, and revokes its credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "azn-cli-http-"));
    const children: ChildProcess[] = [];
    const results: Array<{ stdout: string; stderr: string }> = [];
    const cliPath = resolve(__dirname, "../../cli/bin/azn.mjs");
    async function cli(args: string[], onOutput?: (stderr: string) => void) {
      const child = spawn(process.execPath, [cliPath, ...args], {
        env: {
          ...process.env,
          AZN_CONFIG_DIR: directory,
          AZN_ACCESS_TOKEN: "",
          AZN_SERVER_URL: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      const result = { stdout: "", stderr: "" };
      child.stdout!.setEncoding("utf8").on("data", (chunk: string) => {
        result.stdout += chunk;
      });
      child.stderr!.setEncoding("utf8").on("data", (chunk: string) => {
        result.stderr += chunk;
        onOutput?.(result.stderr);
      });
      const [code] = await once(child, "close");
      results.push(result);
      expect(code, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    }
    try {
      let instructions = "";
      const loggingIn = cli(["auth", "login", "--server", baseUrl, "--no-browser"], (value) => {
        instructions = value;
      });
      await vi.waitFor(
        () =>
          expect(instructions).toMatch(/Enter\/verify code: [A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/),
        { timeout: 5000 },
      );
      const userCode = /Enter\/verify code: ([A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4})/.exec(
        instructions,
      )![1];
      const grant = await prisma.oAuthDeviceAuthorization.findUniqueOrThrow({
        where: { userCodeHash: hashCredential(userCode.replace("-", "")) },
      });
      deviceHashes.push(grant.deviceCodeHash);
      const approved = await request("/api/oauth/authorize", {
        method: "POST",
        headers: { Cookie: cookie, Origin: adminOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: userCode, decision: "allow" }),
      });
      expect(approved.status).toBe(200);
      expect(await loggingIn).toMatchObject({
        authenticated: true,
        scope: "articles:read articles:write",
      });
      const credential = JSON.parse(
        await readFile(join(directory, "credentials.json"), "utf8"),
      ) as { accessToken: string };
      expect(await cli(["auth", "status"])).toMatchObject({
        authenticated: true,
        user: { id: actorId },
      });
      const markdown = "# Remote Agent article\n\nSaved through the real CLI and OAuth API.\n";
      const input = join(directory, "article.md");
      await writeFile(input, markdown);
      const created = await cli([
        "articles",
        "create",
        "--title",
        "CLI article fixture",
        "--description",
        "CLI integration",
        "--file",
        input,
      ]);
      expect(created.status).toBe("DRAFT");
      const articleId = created.id as string;
      articleIds.push(articleId);
      expect(await cli(["articles", "get", articleId])).toMatchObject({
        markdown: markdown.trim(),
      });
      expect(
        await cli(["articles", "update", articleId, "--title", "Updated CLI article fixture"]),
      ).toMatchObject({ title: "Updated CLI article fixture", status: "DRAFT" });
      expect(await cli(["articles", "publish", articleId])).toMatchObject({ status: "PUBLISHED" });
      expect(await prisma.article.findUniqueOrThrow({ where: { id: articleId } })).toMatchObject({
        title: "Updated CLI article fixture",
        markdown: markdown.trim(),
        status: "PUBLISHED",
      });
      expect(
        await prisma.adminOperationLog.count({
          where: { actorUserId: actorId, resourceId: articleId },
        }),
      ).toBe(3);
      expect(await cli(["auth", "logout"])).toEqual({ authenticated: false, revoked: true });
      expect(
        await prisma.oAuthAccessToken.count({
          where: { tokenHash: hashCredential(credential.accessToken) },
        }),
      ).toBe(0);
      expect(
        await readFile(join(directory, "credentials.json"), "utf8").catch(() => null),
      ).toBeNull();
      expect(JSON.stringify(results)).not.toContain(credential.accessToken);
      expect(JSON.stringify(results)).not.toContain("device_code");
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
      await rm(directory, { force: true, recursive: true });
    }
  }, 20000);

  async function request(path: string, init: RequestInit = {}) {
    return fetch(new URL(path, baseUrl), { ...init, signal: AbortSignal.timeout(10000) });
  }
  function form(path: string, body: Record<string, string>) {
    return request(path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
  }
  async function device(scope = "articles:read articles:write") {
    const response = await form("/api/oauth/device/code", { client_id: "azn-cli", scope });
    expect(response.status).toBe(200);
    const result = (await response.json()) as OAuthDeviceCodeResponse;
    deviceHashes.push(hashCredential(result.device_code));
    return result;
  }
  function decide(
    grant: OAuthDeviceCodeResponse,
    decision: "allow" | "deny",
    origin: string | null = adminOrigin,
    session = cookie,
  ) {
    const headers: Record<string, string> = { Cookie: session, "Content-Type": "application/json" };
    if (origin !== null) headers.Origin = origin;
    return request("/api/oauth/authorize", {
      method: "POST",
      headers,
      body: JSON.stringify({ user_code: grant.user_code, decision }),
    });
  }
  function poll(grant: OAuthDeviceCodeResponse) {
    return form("/api/oauth/token", {
      client_id: "azn-cli",
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: grant.device_code,
    });
  }
  function resetPoll(grant: OAuthDeviceCodeResponse) {
    return prisma.oAuthDeviceAuthorization.update({
      where: { deviceCodeHash: hashCredential(grant.device_code) },
      data: { nextPollAt: new Date(0) },
    });
  }
  async function approvedToken(scope = "articles:read articles:write") {
    const grant = await device(scope);
    expect((await decide(grant, "allow")).status).toBe(200);
    const response = await poll(grant);
    expect(response.status).toBe(200);
    return (await response.json()) as OAuthTokenResponse;
  }
  function bearer(token: OAuthTokenResponse) {
    return { Authorization: `Bearer ${token.access_token}` };
  }
});

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}
