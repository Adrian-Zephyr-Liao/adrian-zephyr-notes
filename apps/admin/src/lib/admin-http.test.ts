import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  buildAdminQueryString,
  requestAdminApi,
  resolveBackendApiBaseUrl,
  withAdminQuery,
} from "./admin-http";

describe("admin HTTP helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_BACKEND_API_BASE_URL", "http://localhost:3001");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds query strings without empty filter values", () => {
    expect(
      buildAdminQueryString({
        page: 2,
        q: "markdown",
        status: "ALL",
        unused: undefined,
        empty: "",
        nullable: null,
      }),
    ).toBe("page=2&q=markdown");
    expect(withAdminQuery("/api/admin/articles", { page: 1 })).toBe("/api/admin/articles?page=1");
  });

  it("keeps admin traffic on the same origin when no API origin is configured", () => {
    expect(resolveBackendApiBaseUrl("", "admin.zephyrai.site")).toBe("");
  });

  it("keeps localhost admin traffic on the same origin", () => {
    expect(resolveBackendApiBaseUrl("https://zephyrai.site", "localhost")).toBe("");
    expect(resolveBackendApiBaseUrl("https://zephyrai.site/", "127.0.0.1")).toBe("");
    expect(resolveBackendApiBaseUrl("https://zephyrai.site/", "::1")).toBe("");
  });

  it("uses an explicit API origin on non-localhost admin hosts", () => {
    expect(resolveBackendApiBaseUrl("https://zephyrai.site/", "preview.example.com")).toBe(
      "https://zephyrai.site",
    );
  });

  it("sends JSON requests with credentials and accept headers", async () => {
    const fetch = mockFetch(new Response(JSON.stringify({ ok: true })));

    await expect(
      requestAdminApi<{ ok: boolean }>("/api/admin/example", {
        json: {
          title: "hello",
        },
        method: "POST",
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/admin/example",
      expect.objectContaining({
        body: JSON.stringify({
          title: "hello",
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    const requestInit = fetch.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(requestInit.headers);

    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sends FormData without overriding the browser multipart boundary", async () => {
    const fetch = mockFetch(new Response(JSON.stringify({ ok: true })));
    const body = new FormData();
    body.append("file", new Blob(["image"]), "image.png");

    await requestAdminApi<{ ok: boolean }>("/api/admin/articles/images", {
      body,
      method: "POST",
    });

    const requestInit = fetch.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(requestInit.headers);

    expect(requestInit.body).toBe(body);
    expect(requestInit.credentials).toBe("include");
    expect(headers.has("content-type")).toBe(false);
  });

  it("supports empty successful responses", async () => {
    mockFetch(new Response(null, { status: 204 }));

    await expect(
      requestAdminApi<void>("/api/admin/example", {
        emptyResponse: true,
        method: "DELETE",
      }),
    ).resolves.toBeUndefined();
  });

  it("throws typed admin API errors for failed responses", async () => {
    mockFetch(new Response("Forbidden", { status: 403 }));

    await expect(requestAdminApi("/api/admin/example")).rejects.toMatchObject({
      message: "Admin API request failed: 403",
      status: 403,
    } satisfies Partial<AdminApiError>);
  });

  it("preserves backend business error payloads for recoverable actions", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          code: "ADMIN_AGENT_TASK_BRANCH_UNAVAILABLE",
          details: {
            taskId: "run-1",
          },
          message: "Agent 业务处理当前不能另开分支。",
        }),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 409,
        },
      ),
    );

    await expect(requestAdminApi("/api/admin/agent/tasks/run-1/control")).rejects.toMatchObject({
      code: "ADMIN_AGENT_TASK_BRANCH_UNAVAILABLE",
      details: {
        taskId: "run-1",
      },
      message: "Agent 业务处理当前不能另开分支。",
      status: 409,
    } satisfies Partial<AdminApiError>);
  });

  it("reads nested Nest error envelopes", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: {
            code: "ARTICLE_IMAGE_TYPE_UNSUPPORTED",
            message: "仅支持 JPEG、PNG、WebP 和 GIF 图片。",
          },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 400,
        },
      ),
    );

    await expect(requestAdminApi("/api/admin/articles/images")).rejects.toMatchObject({
      code: "ARTICLE_IMAGE_TYPE_UNSUPPORTED",
      message: "仅支持 JPEG、PNG、WebP 和 GIF 图片。",
      status: 400,
    } satisfies Partial<AdminApiError>);
  });
});

function mockFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);

  vi.stubGlobal("fetch", fetch);

  return fetch;
}
