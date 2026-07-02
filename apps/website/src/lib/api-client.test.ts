import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, isApiRequestError, requestJson } from "./api-client";

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
});

function mockFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
