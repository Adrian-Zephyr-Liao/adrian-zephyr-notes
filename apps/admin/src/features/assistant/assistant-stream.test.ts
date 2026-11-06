import { createServer, type RequestListener, type Server, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamAssistantTurn } from "./assistant-stream";

const nativeFetch = globalThis.fetch;
let server: Server | undefined;

beforeEach(() => vi.stubEnv("VITE_BACKEND_API_BASE_URL", ""));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
});

describe("assistant HttpAgent transport", () => {
  it("does not send a request if cancelled while the SDK is loading", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const run = streamAssistantTurn({
      conversationId: "conversation-1",
      requestId: "request-1",
      input: "查看审计日志",
      onTextDelta: () => {},
      onToolStart: () => {},
    });
    run.abort();
    expect(await run.finished).toEqual({ terminal: "interrupted" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("compares a test-only raw SSE reader against the same HTTP fixture", async () => {
    const baseUrl = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of events()) writeEvent(response, event);
      response.end();
    });
    const result = await readRawSsePrototype(await nativeFetch(baseUrl));
    expect(
      result.filter((event) => event.type === "TEXT_MESSAGE_CONTENT").map((event) => event.delta),
    ).toEqual(["哈", "哈"]);
    expect(result.at(-1)?.type).toBe("RUN_FINISHED");
  });
  it("uses the authenticated admin transport and appends repeated Chinese deltas from real HTTP SSE", async () => {
    let requestBody: unknown;
    let credentials: RequestCredentials | undefined;
    const baseUrl = await listen(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      requestBody = JSON.parse(Buffer.concat(chunks).toString()) as unknown;
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of events()) {
        const frame = `data: ${JSON.stringify(event)}\n\n`;
        response.write(frame.slice(0, 7));
        response.write(frame.slice(7));
      }
      response.end();
    });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      credentials = init.credentials;
      return nativeFetch(`${baseUrl}${url}`, init);
    });
    const deltas: string[] = [];
    const run = streamAssistantTurn({
      conversationId: "conversation-1",
      requestId: "request-1",
      input: "查看审计日志",
      onTextDelta: (delta) => deltas.push(delta),
      onToolStart: () => {},
    });

    expect(await run.finished).toEqual({ terminal: "finished" });
    expect(deltas).toEqual(["哈", "哈"]);
    expect(credentials).toBe("include");
    expect(requestBody).toMatchObject({
      protocolVersion: "1.0",
      threadId: "conversation-1",
      runId: "request-1",
      tools: [],
      context: [],
      state: {},
      messages: [{ id: "request-1:input", role: "user", content: "查看审计日志" }],
    });
  });

  it("keeps EOF without a terminal event interrupted", async () => {
    const baseUrl = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of events().slice(0, 3)) writeEvent(response, event);
      response.end();
    });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) =>
      nativeFetch(`${baseUrl}${url}`, init),
    );
    const run = streamAssistantTurn({
      conversationId: "conversation-1",
      requestId: "request-1",
      input: "查看审计日志",
      onTextDelta: () => {},
      onToolStart: () => {},
    });
    expect((await run.finished).terminal).toBe("interrupted");
  });

  it("aborts the actual HTTP connection after streamed text", async () => {
    let receivedText!: () => void;
    const text = new Promise<void>((resolve) => (receivedText = resolve));
    let closed!: () => void;
    const connectionClosed = new Promise<void>((resolve) => (closed = resolve));
    const baseUrl = await listen((_request, response) => {
      response.on("close", closed);
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of events().slice(0, 3)) writeEvent(response, event);
    });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) =>
      nativeFetch(`${baseUrl}${url}`, init),
    );
    const run = streamAssistantTurn({
      conversationId: "conversation-1",
      requestId: "request-1",
      input: "查看审计日志",
      onTextDelta: receivedText,
      onToolStart: () => {},
    });
    await text;
    run.abort();
    expect((await run.finished).terminal).toBe("interrupted");
    await connectionClosed;
  });
});

async function listen(handler: RequestListener) {
  server = createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test HTTP address");
  return `http://127.0.0.1:${address.port}`;
}

function writeEvent(response: ServerResponse, event: object) {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function events() {
  return [
    { type: "RUN_STARTED", threadId: "conversation-1", runId: "request-1" },
    { type: "TEXT_MESSAGE_START", messageId: "response-1", role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: "response-1", delta: "哈" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: "response-1", delta: "哈" },
    { type: "TEXT_MESSAGE_END", messageId: "response-1" },
    { type: "RUN_FINISHED", threadId: "conversation-1", runId: "request-1" },
  ];
}

// P0 comparison only. Product code uses HttpAgent's framing and event validation.
async function readRawSsePrototype(response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Expected SSE response");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");
  const decoder = new TextDecoder();
  const result: Record<string, unknown>[] = [];
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (!data) continue;
        const event: unknown = JSON.parse(data);
        if (!event || typeof event !== "object" || Array.isArray(event) || !("type" in event))
          throw new Error("Invalid event");
        result.push(event as Record<string, unknown>);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (
    result[0]?.type !== "RUN_STARTED" ||
    !["RUN_FINISHED", "RUN_ERROR"].includes(String(result.at(-1)?.type))
  )
    throw new Error("Incomplete run");
  return result;
}
