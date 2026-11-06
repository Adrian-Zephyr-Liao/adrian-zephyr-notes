import { PassThrough } from "node:stream";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Express, Request, Response } from "express";
import { ExpressAdapter } from "@nestjs/platform-express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendAdminAgentChatMessageInput } from "../application/send-admin-agent-chat-message.use-case";
import {
  AdminAgentCopilotKitController,
  writeFetchResponse,
} from "./admin-agent-copilotkit.controller";

beforeEach(() => vi.stubEnv("COPILOTKIT_TELEMETRY_DISABLED", "true"));
afterEach(() => vi.unstubAllEnvs());

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

  it("cancels the response body when the HTTP client disconnects", async () => {
    const cancelled = vi.fn();
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller;
        controller.enqueue(new TextEncoder().encode("data: started\n\n"));
      },
      cancel: cancelled,
    });
    try {
      await withHttpServer(
        (_request, response) =>
          writeFetchResponse(
            response,
            new globalThis.Response(body, { headers: { "Content-Type": "text/event-stream" } }),
          ),
        async (url) => {
          const disconnect = new AbortController();
          const response = await fetch(url, { signal: disconnect.signal });
          await response.body!.getReader().read();
          disconnect.abort();
          await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
        },
      );
    } finally {
      if (!cancelled.mock.calls.length) bodyController.close();
    }
  });

  it("propagates response body failures", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("SSE body failed"));
      },
    });
    await expect(
      writeFetchResponse(new TestResponse() as unknown as Response, new globalThis.Response(body)),
    ).rejects.toThrow("SSE body failed");
  });

  it("keeps backpressure while the response consumer is paused", async () => {
    const response = new TestResponse();
    response.pause();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls === 64) controller.close();
        else {
          pulls++;
          controller.enqueue(new Uint8Array(32768));
        }
      },
    });
    const pending = writeFetchResponse(
      response as unknown as Response,
      new globalThis.Response(body),
    );
    try {
      await vi.waitFor(() => expect(pulls).toBeGreaterThan(0));
      expect(pulls).toBeLessThan(64);
    } finally {
      response.resume();
      await pending;
    }
    expect(response.body.length).toBe(64 * 32768);
  });
});

describe("AdminAgentCopilotKitController HTTP streaming", () => {
  it("suspends the request stream through the actual eager runtime on disconnect", async () => {
    let signal: AbortSignal | undefined;
    let release: (() => void) | undefined;
    const disposed = vi.fn();
    const handled = vi.fn();
    const abortConversation = vi.fn();
    const stream = vi.fn(async function* (input: SendAdminAgentChatMessageInput) {
      signal = input.signal;
      try {
        yield { type: "textDelta" as const, delta: "开始回复" };
        if (!signal?.aborted)
          await new Promise<void>((resolve) => {
            release = resolve;
            signal?.addEventListener("abort", () => resolve(), { once: true });
          });
      } finally {
        disposed();
      }
    });
    const controller = new AdminAgentCopilotKitController(
      { stream, abortConversation } as never,
      { create: () => [] } as never,
      {} as never,
    );
    try {
      await withHttpServer(
        async (request, response) => {
          await controller.handle(request, response, admin);
          handled();
        },
        async (url) => {
          const disconnect = new AbortController();
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(runRequest()),
            signal: disconnect.signal,
          });
          expect(response.status).toBe(200);
          await response.body!.getReader().read();
          await vi.waitFor(() => expect(stream).toHaveBeenCalledOnce());
          disconnect.abort();
          await vi.waitFor(() => expect(signal?.aborted).toBe(true));
          await vi.waitFor(() => expect(disposed).toHaveBeenCalledOnce());
          await vi.waitFor(() => expect(handled).toHaveBeenCalledOnce());
          expect(abortConversation).not.toHaveBeenCalled();
        },
      );
    } finally {
      release?.();
    }
  });

  it("finishes a normal HTTP stream with one terminal event", async () => {
    let abortedDuringStream: boolean | undefined;
    const stream = vi.fn(async function* (input: SendAdminAgentChatMessageInput) {
      try {
        yield { type: "textDelta" as const, delta: "完成回复" };
      } finally {
        abortedDuringStream = input.signal?.aborted;
      }
    });
    const controller = new AdminAgentCopilotKitController(
      { stream } as never,
      { create: () => [] } as never,
      {} as never,
    );
    await withHttpServer(
      (request, response) => controller.handle(request, response, admin),
      async (url) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(runRequest()),
        });
        const body = await response.text();
        expect(body).toContain("完成回复");
        expect(body.match(/"type":"RUN_FINISHED"/g)).toHaveLength(1);
        expect(body).not.toContain("RUN_ERROR");
        expect(abortedDuringStream).toBe(false);
      },
    );
  });
});

const admin = {
  id: "admin-1",
  githubId: "github-admin-1",
  login: "admin",
  name: null,
  avatarUrl: null,
  profileUrl: "https://example.test/admin",
};

function runRequest() {
  return {
    method: "agent/run",
    params: { agentId: "admin-agent" },
    body: {
      threadId: randomUUID(),
      runId: randomUUID(),
      state: {},
      messages: [{ id: randomUUID(), role: "user", content: "请回复" }],
      tools: [],
      context: [],
    },
  };
}

async function withHttpServer(
  handler: (request: Request, response: Response) => Promise<void>,
  test: (url: string) => Promise<void>,
) {
  const adapter = new ExpressAdapter();
  adapter.registerParserMiddleware();
  const app = adapter.getInstance<Express>();
  app.use((request, response, next) => {
    void handler(request, response).catch(next);
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await test(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/copilotkit`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

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
