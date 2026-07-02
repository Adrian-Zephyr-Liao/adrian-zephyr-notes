import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyBackendRequest } from "./backend-api";

describe("proxyBackendRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("forwards query params, cookies, JSON bodies, and response metadata", async () => {
    vi.stubEnv("BACKEND_API_BASE_URL", "http://backend.test/");
    const fetch = mockFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "set-cookie": "azn_session=session-token; Path=/",
        },
      }),
    );

    const response = await proxyBackendRequest(createRequestDouble(), {
      body: JSON.stringify({ body: "hello" }),
      path: "api/comments",
    });

    const [input, init] = fetch.mock.calls[0]!;
    expect(String(input)).toBe("http://backend.test/api/comments?page=2");
    expect(init).toMatchObject({
      body: JSON.stringify({ body: "hello" }),
      cache: "no-store",
      method: "POST",
    });
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(new Headers(init.headers).get("cookie")).toBe("azn_session=session-token");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("set-cookie")).toContain("azn_session=session-token");
  });

  it("forwards client headers only when requested", async () => {
    const fetch = mockFetch(new Response("{}"));

    await proxyBackendRequest(createRequestDouble(), {
      forwardClientHeaders: true,
      path: "/api/guestbook/messages",
    });

    const requestInit = fetch.mock.calls[0]![1];
    const headers = new Headers(requestInit.headers);
    expect(headers.get("user-agent")).toBe("Mobile Safari");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.10");
  });

  it("preserves empty proxied responses without a content type", async () => {
    mockFetch(new Response(null, { status: 204 }));

    const response = await proxyBackendRequest(createRequestDouble(), {
      method: "POST",
      path: "/api/auth/logout",
      responseBody: "empty",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    await expect(response.text()).resolves.toBe("");
  });
});

function createRequestDouble() {
  return {
    headers: new Headers({
      "cf-connecting-ip": "203.0.113.10",
      cookie: "azn_session=session-token",
      "user-agent": "Mobile Safari",
    }),
    nextUrl: {
      searchParams: new URLSearchParams({
        page: "2",
      }),
    },
  };
}

function mockFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
