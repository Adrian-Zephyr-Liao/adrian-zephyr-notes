import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, ApiResponseError, isApiRequestError, requestJson } from "./api-client";

describe("requestJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON responses", async () => {
    mockFetch(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    await expect(requestJson<{ ok: boolean }>("/api/example")).resolves.toEqual({ ok: true });
  });

  it("serializes JSON request bodies and sets a content type", async () => {
    const fetch = mockFetch(new Response("{}"));

    await requestJson("/api/example", {
      method: "POST",
      json: {
        body: "hello",
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/example",
      expect.objectContaining({
        body: JSON.stringify({
          body: "hello",
        }),
        headers: expect.any(Headers),
        method: "POST",
      }),
    );
    const requestInit = fetch.mock.calls[0]![1] as RequestInit;
    expect(new Headers(requestInit.headers).get("content-type")).toBe("application/json");
  });

  it("throws ApiRequestError with structured error payloads", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "Slow down",
          },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(requestJson("/api/example")).rejects.toMatchObject({
      message: "Slow down",
      payload: {
        error: {
          code: "RATE_LIMITED",
          message: "Slow down",
        },
      },
      status: 429,
    } satisfies Partial<ApiRequestError>);
  });

  it("identifies request errors", () => {
    expect(isApiRequestError(new ApiRequestError(404, null))).toBe(true);
    expect(isApiRequestError(new Error("plain"))).toBe(false);
  });

  it.each(["", "<html>upstream error</html>", '{"incomplete":'])(
    "rejects an invalid successful JSON response without repeating a write: %s",
    async (body) => {
      const fetch = mockFetch(new Response(body, { status: 201 }));

      await expect(
        requestJson("/api/guestbook/messages", { method: "POST", json: { body: "hello" } }),
      ).rejects.toBeInstanceOf(ApiResponseError);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([204, 205])("accepts an intentionally empty %i response", async (status) => {
    mockFetch(new Response(null, { status }));

    await expect(requestJson("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("retains HTTP failure status when the error body is not JSON", async () => {
    mockFetch(new Response("Bad gateway", { status: 502 }));

    await expect(requestJson("/api/example")).rejects.toMatchObject({
      status: 502,
      payload: null,
      message: "Request failed: 502",
    });
  });
});

function mockFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
