import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serverUrl } from "./auth/credentials.ts";

const executable = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/azn.mjs");
const accessToken = "test_access_token_0123456789_abcdefghijklmnop";

describe("CLI subprocess with an HTTP API", () => {
  let directory: string;
  let server: Server;
  let origin: string;
  let polls = 0;
  const received: { path: string; method: string; authorization?: string; body: string }[] = [];

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "azn-cli-"));
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      received.push({
        path: request.url!,
        method: request.method!,
        authorization: request.headers.authorization,
        body,
      });
      response.setHeader("content-type", "application/json");
      if (request.url === "/api/oauth/device/code") {
        expect(new URLSearchParams(body).get("client_id")).toBe("azn-cli");
        response.end(
          JSON.stringify({
            device_code: "device_0123456789_abcdefghijklmnop",
            user_code: "ABCD-EFGH",
            verification_uri: `${origin}/oauth/device`,
            verification_uri_complete: `${origin}/oauth/device?user_code=ABCD-EFGH`,
            expires_in: 60,
            interval: 1,
          }),
        );
      } else if (request.url === "/api/oauth/token") {
        expect(new URLSearchParams(body).get("grant_type")).toBe(
          "urn:ietf:params:oauth:grant-type:device_code",
        );
        polls++;
        response.statusCode = polls === 1 ? 400 : 200;
        response.end(
          JSON.stringify(
            polls === 1
              ? { error: "authorization_pending" }
              : {
                  access_token: accessToken,
                  token_type: "Bearer",
                  expires_in: 28800,
                  scope: "admin:read admin:write",
                },
          ),
        );
      } else if (request.url === "/api/oauth/revoke") {
        expect(new URLSearchParams(body).get("token")).toBe(accessToken);
        response.end();
      } else if (request.url === "/api/admin/articles/denied") {
        response.statusCode = 401;
        response.end(
          JSON.stringify({
            error: { code: "OAUTH_AUTH_REQUIRED", message: "Authorization expired" },
          }),
        );
      } else if (request.url === "/api/admin/articles/network-failure") {
        request.socket.destroy();
      } else if (request.url === "/api/admin/articles/truncated") {
        response.writeHead(200);
        response.write('{"id":"saved-but-response-lost"');
        setTimeout(() => response.destroy(), 20);
      } else if (request.url === "/api/admin/articles/redirect") {
        response.writeHead(302, { location: `${origin}/api/admin/articles/leaked` });
        response.end();
      } else {
        response.end(JSON.stringify({ id: "article-1", ...JSON.parse(body || "{}") }));
      }
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    await rm(directory, { recursive: true, force: true });
  });

  function cli(args: string[], input = "", environment: Record<string, string> = {}) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
      const child = spawn(process.execPath, [executable, ...args], {
        env: {
          ...process.env,
          AZN_ACCESS_TOKEN: "",
          AZN_SERVER_URL: "",
          AZN_CONFIG_DIR: directory,
          ...environment,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("exit", (code) => done({ code, stdout, stderr }));
      child.stdin.end(input);
    });
  }

  it("signs in without a browser, persists a private token, and never prints secrets", async () => {
    const result = await cli(["auth", "login", "--server", origin, "--no-browser"]);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ authenticated: true, server: origin });
    expect(result.stderr).toContain("ABCD-EFGH");
    expect(result.stderr).toContain("/oauth/device?user_code=");
    expect(result.stdout + result.stderr).not.toContain(accessToken);
    expect(result.stdout + result.stderr).not.toContain("device_0123456789_abcdefghijklmnop");
    expect(polls).toBe(2);
    const path = join(directory, "credentials.json");
    expect(JSON.parse(await readFile(path, "utf8")).accessToken).toBe(accessToken);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  }, 10000);

  it("sends UTF-8 Markdown from stdin as a draft and publishes only by explicit command", async () => {
    const result = await cli(
      ["articles", "create", "--title", "中文文章", "--description", "摘要", "--file", "-"],
      "# 正文\n\n内容\n",
    );
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      title: "中文文章",
      status: "DRAFT",
      markdown: "# 正文\n\n内容\n",
    });
    expect(received.at(-1)).toMatchObject({
      method: "POST",
      path: "/api/admin/articles",
      authorization: `Bearer ${accessToken}`,
    });
    const file = join(directory, "article.json");
    await writeFile(
      file,
      JSON.stringify({ markdown: "修订正文", tagSlugs: [], categorySlug: null }),
    );
    expect((await cli(["articles", "update", "article-1", "--input", file])).code).toBe(0);
    expect(JSON.parse(received.at(-1)!.body)).toEqual({
      markdown: "修订正文",
      tagSlugs: [],
      categorySlug: null,
    });
    const published = await cli(["articles", "publish", "article-1"]);
    expect(published.code).toBe(0);
    expect(JSON.parse(received.at(-1)!.body)).toEqual({ status: "PUBLISHED" });
  });

  it("rejects publishing by JSON input, unknown fields, and duplicated options before any HTTP write", async () => {
    const file = join(directory, "unsafe.json");
    const count = received.length;
    await writeFile(file, JSON.stringify({ title: "A", markdown: "B", status: "PUBLISHED" }));
    expect((await cli(["articles", "create", "--input", file])).code).toBe(1);
    await writeFile(file, JSON.stringify({ title: "A", markdown: "B", actorId: "forged" }));
    expect((await cli(["articles", "create", "--input", file])).code).toBe(1);
    expect((await cli(["articles", "list", "--server", origin, "--server", origin])).code).toBe(1);
    expect(received).toHaveLength(count);
  });

  it("does not send a saved token to a different origin or follow API redirects", async () => {
    const count = received.length;
    const result = await cli(["articles", "list", "--server", "https://different.example"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error.code).toBe("SERVER_MISMATCH");
    expect(received).toHaveLength(count);
    const redirect = await cli(["articles", "get", "redirect"]);
    expect(redirect.code).toBe(1);
    expect(received.at(-1)?.path).toBe("/api/admin/articles/redirect");
    expect(received.filter((entry) => entry.path.endsWith("leaked"))).toHaveLength(0);
  });

  it("returns structured auth errors and never retries uncertain writes", async () => {
    const denied = await cli(["articles", "get", "denied"]);
    expect(denied.code).toBe(1);
    expect(denied.stdout).toBe("");
    expect(JSON.parse(denied.stderr)).toMatchObject({
      error: { code: "OAUTH_AUTH_REQUIRED", status: 401 },
    });
    const result = await cli(["articles", "update", "network-failure", "--title", "new"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error.message).toContain("outcome may be unknown");
    expect(received.filter((entry) => entry.path.endsWith("network-failure"))).toHaveLength(1);
    const truncated = await cli(["articles", "update", "truncated", "--title", "new"]);
    expect(truncated.code).toBe(1);
    expect(JSON.parse(truncated.stderr).error).toMatchObject({
      code: "INVALID_RESPONSE",
      message: expect.stringContaining("outcome may be unknown"),
    });
    expect(received.filter((entry) => entry.path.endsWith("truncated"))).toHaveLength(1);
  });

  it("revokes the token on logout, then requires login for another write", async () => {
    const result = await cli(["auth", "logout"]);
    expect(result.code, result.stderr).toBe(0);
    await expect(stat(join(directory, "credentials.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const count = received.length;
    const unsigned = await cli(["articles", "list"]);
    expect(unsigned.code).toBe(1);
    expect(JSON.parse(unsigned.stderr).error.code).toBe("AUTH_REQUIRED");
    expect(received).toHaveLength(count);
  });
});

it("requires HTTPS except on loopback and refuses credentials in server URLs", () => {
  expect(serverUrl("https://blog.example/")).toBe("https://blog.example");
  expect(() => serverUrl("http://blog.example")).toThrow();
  expect(() => serverUrl("https://user:secret@blog.example")).toThrow();
  expect(() => serverUrl("https://blog.example/api")).toThrow();
});
