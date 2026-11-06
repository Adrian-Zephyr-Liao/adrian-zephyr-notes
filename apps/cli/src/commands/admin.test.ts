import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../cli.ts";

const id = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const fetchMock = vi.fn<typeof fetch>();
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "azn-admin-commands-"));
  vi.stubEnv("AZN_SERVER_URL", "https://blog.example");
  vi.stubEnv("AZN_ACCESS_TOKEN", "test_admin_token_0123456789_abcdefghijklmnop");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_input, init) =>
    init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ ok: true }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

async function input(value: unknown) {
  const path = join(directory, "input.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

function urlOf(input: Parameters<typeof fetch>[0]) {
  return typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: new URL(urlOf(url)),
    method: init?.method ?? "GET",
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

describe("administrator commands through Commander and the HTTP client", () => {
  it.each(["categories", "tags"])("supports all %s list and mutation endpoints", async (group) => {
    await runCli([group, "list", "--query", "中文", "--page", "2", "--page-size", "20"]);
    expect(lastRequest().url.pathname).toBe(`/api/admin/article-${group}`);
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({
      q: "中文",
      page: "2",
      pageSize: "20",
    });

    await runCli([group, "create", "--name", "测试", "--slug", "test"]);
    expect(lastRequest()).toMatchObject({ method: "POST", body: { name: "测试", slug: "test" } });
    await runCli([group, "update", id, "--name", "修订"]);
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { name: "修订" } });
    expect(lastRequest().url.pathname).toBe(`/api/admin/article-${group}/${id}`);

    expect(await runCli([group, "delete", id, "--yes"])).toEqual({ deleted: true, id });
    expect(lastRequest().method).toBe("DELETE");
  });

  it("requires explicit deletion/merge confirmation and never writes after invalid input", async () => {
    await expect(runCli(["tags", "delete", id, "--json"])).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });
    await expect(runCli(["tags", "merge", id, "--target", id, "--yes"])).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(runCli(["categories", "update", "..", "--name", "x"])).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(
      runCli(["tags", "create", "--input", await input({ name: "test", slug: "x", actorId: id })]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();

    await runCli(["tags", "merge", id, "--target", target, "--yes"]);
    expect(lastRequest()).toMatchObject({ method: "POST", body: { targetTagId: target } });
    expect(lastRequest().url.pathname).toBe(`/api/admin/article-tags/${id}/merge`);
  });

  it("keeps current-user cloud drafts separate from articles and preserves null", async () => {
    await runCli(["drafts", "get", "--article-id", id]);
    expect(lastRequest().url.pathname).toBe("/api/admin/article-drafts/current");
    expect(lastRequest().url.searchParams.get("articleId")).toBe(id);
    const body = {
      articleId: null,
      baseArticleUpdatedAt: null,
      clientSavedAt: "2026-11-06T00:00:00Z",
      values: { markdown: "草稿", tagSlugs: [] },
    };
    await runCli(["drafts", "save", "--input", await input(body)]);
    expect(lastRequest()).toMatchObject({ method: "PUT", body });
    expect(await runCli(["drafts", "delete", "--yes"])).toEqual({ deleted: true, articleId: null });
    expect(lastRequest().url.search).toBe("");
  });

  it("previews the exact comment before an explicit status decision", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      Response.json(
        init?.method === "PATCH"
          ? { id, status: "HIDDEN" }
          : {
              data: [
                {
                  id,
                  body: "待审核评论",
                  status: "VISIBLE",
                  article: { title: "文章" },
                  author: { login: "visitor" },
                },
              ],
            },
      ),
    );
    await expect(
      runCli(["comments", "update", id, "--status", "HIDDEN", "--json"]),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
    await runCli(["comments", "update", id, "--status", "HIDDEN", "--yes"]);
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { status: "HIDDEN" } });
    expect(lastRequest().url.pathname).toBe(`/api/admin/comments/${id}`);
    expect(new URL(urlOf(fetchMock.mock.calls[0][0])).searchParams.get("commentId")).toBe(id);
  });

  it("preserves false for guestbook pinning and validates statuses before HTTP", async () => {
    await runCli(["guestbook", "update", id, "--pinned", "false", "--status", "DELETED", "--yes"]);
    expect(lastRequest()).toMatchObject({
      method: "PATCH",
      body: { isPinned: false, status: "DELETED" },
    });
    expect(lastRequest().url.pathname).toBe(`/api/admin/guestbook/messages/${id}`);
    fetchMock.mockClear();
    await expect(
      runCli(["guestbook", "update", id, "--pinned", "no", "--yes"]),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(runCli(["comments", "list", "--status", "DELETED"])).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a complete settings document and preserves announcement false and zero", async () => {
    const settings = {
      home: { title: "标题" },
      navigationItems: [],
      socialLinks: [{ id, isEnabled: false, sortOrder: 0 }],
    };
    await runCli(["site", "update", "--input", await input(settings), "--yes"]);
    expect(lastRequest()).toMatchObject({ method: "PUT", body: settings });
    expect(lastRequest().url.pathname).toBe("/api/admin/site-config/settings");
    fetchMock.mockClear();
    await expect(
      runCli(["site", "update", "--input", await input({ home: {} }), "--yes"]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
    await runCli([
      "announcements",
      "update",
      id,
      "--enabled",
      "false",
      "--sort-order",
      "0",
      "--output",
      "",
      "--yes",
    ]);
    expect(lastRequest()).toMatchObject({
      method: "PATCH",
      body: { isEnabled: false, sortOrder: 0, output: "" },
    });
    expect(lastRequest().url.pathname).toBe(`/api/admin/site-config/announcements/${id}`);
  });

  it("covers read-only moderation, settings, announcements and audit filters", async () => {
    await runCli(["comments", "list", "--comment-id", id, "--status", "HIDDEN"]);
    expect(lastRequest().url.searchParams.get("commentId")).toBe(id);
    await runCli(["guestbook", "list", "--status", "DELETED", "--query", "访客"]);
    expect(lastRequest().url.searchParams.get("q")).toBe("访客");
    fetchMock.mockResolvedValueOnce(Response.json({ announcements: [{ id, isEnabled: false }] }));
    expect(await runCli(["announcements", "list"])).toEqual([{ id, isEnabled: false }]);
    await runCli(["site", "get"]);
    expect(lastRequest().url.pathname).toBe("/api/admin/site-config");
    await runCli([
      "audit",
      "list",
      "--actor",
      "admin",
      "--action",
      "ARTICLE_UPDATED",
      "--query",
      "x",
    ]);
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({
      q: "x",
      action: "ARTICLE_UPDATED",
      actorLogin: "admin",
    });
  });

  it("builds dashboard counts from actual list pagination and propagates failures", async () => {
    fetchMock.mockImplementation(async (url) => {
      const parsed = new URL(urlOf(url));
      const count =
        parsed.searchParams.get("status") === "DRAFT"
          ? 2
          : parsed.searchParams.get("status") === "HIDDEN"
            ? 3
            : parsed.searchParams.get("status") === "DELETED"
              ? 4
              : 5;
      return Response.json({ data: [], pagination: { totalItems: count } });
    });
    expect(await runCli(["dashboard", "get"])).toMatchObject({
      counts: { articles: 5, drafts: 2, hiddenComments: 3, deletedGuestbook: 4 },
    });
    fetchMock.mockRejectedValueOnce(new TypeError("Offline"));
    await expect(runCli(["dashboard", "get"])).rejects.toMatchObject({ code: "REQUEST_FAILED" });
  });
});
