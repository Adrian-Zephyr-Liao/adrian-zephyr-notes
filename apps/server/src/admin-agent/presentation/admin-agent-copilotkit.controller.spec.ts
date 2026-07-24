import { PassThrough } from "node:stream";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { writeFetchResponse } from "./admin-agent-copilotkit.controller";

describe("writeFetchResponse", () => {
  it("disables intermediary buffering and flushes SSE headers before streaming the body", async () => {
    const response = new TestResponse();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"RUN_STARTED"}\n\n'));
        controller.close();
      },
    });

    await writeFetchResponse(
      response as unknown as Response,
      new globalThis.Response(body, {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "text/event-stream",
        },
      }),
    );

    expect(response.getHeader("cache-control")).toBe("no-cache, no-transform");
    expect(response.getHeader("x-accel-buffering")).toBe("no");
    expect(response.flushHeaders).toHaveBeenCalledOnce();
    expect(response.body).toContain("RUN_STARTED");
  });
});

class TestResponse extends PassThrough {
  readonly flushHeaders = vi.fn();
  statusCode = 200;
  private readonly responseHeaders = new Map<string, string | number | readonly string[]>();
  private readonly chunks: Buffer[] = [];

  constructor() {
    super();
    this.on("data", (chunk: Buffer) => {
      this.chunks.push(chunk);
    });
  }

  get body() {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  getHeader(name: string) {
    return this.responseHeaders.get(name.toLowerCase());
  }

  setHeader(name: string, value: string | number | readonly string[]) {
    this.responseHeaders.set(name.toLowerCase(), value);
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }
}
