import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../cli.ts";

const conversationId = "11111111-1111-4111-8111-111111111111";
const actionId = "22222222-2222-4222-8222-222222222222";
const cursor = "33333333-3333-4333-8333-333333333333";
const turnRequestId = "request-1";
const base = `/api/admin/assistant/conversations/${conversationId}`;
const fetchMock = vi.fn<typeof fetch>();
let progressMessages: string[];

function urlOf(input: Parameters<typeof fetch>[0]) {
  return typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
}

function bodyOf(init?: RequestInit) {
  if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
  return JSON.parse(init.body);
}

function turn(status = "COMPLETED") {
  return {
    id: cursor,
    conversationId,
    requestId: turnRequestId,
    status,
    input: "你好",
    messages: [],
    toolResults: [],
    actions: [
      {
        id: actionId,
        conversationId,
        commentId: cursor,
        commentBody: "待审核",
        authorLogin: "visitor",
        articleTitle: "文章",
        currentStatus: "VISIBLE",
        targetStatus: "HIDDEN",
        status: "PENDING",
      },
    ],
    error: null,
  };
}

function sse(finish = true) {
  const events = [
    { type: "RUN_STARTED", threadId: conversationId, runId: turnRequestId },
    { type: "TEXT_MESSAGE_START", messageId: "reply-1", role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: "reply-1", delta: "你好" },
    { type: "TEXT_MESSAGE_END", messageId: "reply-1" },
    ...(finish ? [{ type: "RUN_FINISHED", threadId: conversationId, runId: turnRequestId }] : []),
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

beforeEach(() => {
  vi.stubEnv("AZN_SERVER_URL", "https://blog.example");
  vi.stubEnv("AZN_ACCESS_TOKEN", "test_admin_token_0123456789_abcdefghijklmnop");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  progressMessages = [];
  vi.spyOn(console, "error").mockImplementation((message: unknown) => {
    progressMessages.push(typeof message === "string" ? message : JSON.stringify(message));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("assistant commands using the real AG-UI client", () => {
  it("covers capabilities, create, cursor history, turn and explicit stop routes", async () => {
    fetchMock.mockImplementation(async () => Response.json(turn("CANCELLED")));
    await runCli(["assistant", "capabilities"]);
    expect(urlOf(fetchMock.mock.calls.at(-1)![0])).toBe(
      "https://blog.example/api/admin/assistant/capabilities",
    );
    await runCli(["assistant", "create"]);
    expect(fetchMock.mock.calls.at(-1)![1]?.method).toBe("POST");
    await runCli(["assistant", "history", conversationId, "--before", cursor, "--limit", "100"]);
    const history = new URL(urlOf(fetchMock.mock.calls.at(-1)![0]));
    expect(Object.fromEntries(history.searchParams)).toEqual({ before: cursor, limit: "100" });
    await runCli(["assistant", "turn", conversationId, turnRequestId]);
    expect(urlOf(fetchMock.mock.calls.at(-1)![0])).toBe(
      `https://blog.example${base}/turns/${turnRequestId}`,
    );
    expect(await runCli(["assistant", "stop", conversationId, turnRequestId])).toMatchObject({
      status: "CANCELLED",
    });
    expect(urlOf(fetchMock.mock.calls.at(-1)![0])).toBe(
      `https://blog.example${base}/turns/${turnRequestId}/stop`,
    );
  });

  it("sends stable run identity through the SDK and verifies the persisted result", async () => {
    fetchMock.mockImplementation(async (url) =>
      urlOf(url).endsWith("/run") ? sse() : Response.json(turn()),
    );
    const result = await runCli([
      "assistant",
      "run",
      conversationId,
      "--message",
      " 你好 ",
      "--request-id",
      turnRequestId,
      "--events",
    ]);
    expect(result).toMatchObject({
      requestId: turnRequestId,
      status: "COMPLETED",
      transport: "finished",
    });
    const requests = fetchMock.mock.calls;
    expect(requests).toHaveLength(2);
    const body = bodyOf(requests[0][1]);
    expect(body).toMatchObject({
      threadId: conversationId,
      runId: turnRequestId,
      messages: [{ id: `${turnRequestId}:input`, role: "user", content: "你好" }],
      tools: [],
      context: [],
      forwardedProps: {},
    });
    expect(Object.hasOwn(body, "actorId")).toBe(false);
    expect(urlOf(requests[1][0])).toBe(`https://blog.example${base}/turns/${turnRequestId}`);
    expect(progressMessages.join("\n")).toContain("TEXT_MESSAGE_CONTENT");
  });

  it("does not treat a finished stream as a completed persisted run", async () => {
    fetchMock.mockImplementation(async (url) =>
      urlOf(url).endsWith("/run")
        ? sse()
        : Response.json({
            ...turn("FAILED"),
            error: { code: "MODEL_FAILED", message: "模型失败" },
          }),
    );
    await expect(
      runCli([
        "assistant",
        "run",
        conversationId,
        "--message",
        "你好",
        "--request-id",
        turnRequestId,
      ]),
    ).rejects.toMatchObject({ code: "ASSISTANT_RUN_FAILED" });
    expect(fetchMock.mock.calls.filter(([url]) => urlOf(url).endsWith("/run"))).toHaveLength(1);
  });

  it("returns an unknown result with the original identity and never replays a failed stream", async () => {
    fetchMock.mockRejectedValue(new TypeError("Connection lost"));
    await expect(
      runCli([
        "assistant",
        "run",
        conversationId,
        "--message",
        "你好",
        "--request-id",
        turnRequestId,
      ]),
    ).rejects.toMatchObject({
      code: "ASSISTANT_RESULT_UNKNOWN",
      message: expect.stringContaining(turnRequestId),
    });
    expect(fetchMock.mock.calls.filter(([url]) => urlOf(url).endsWith("/run"))).toHaveLength(1);
  });

  it("previews the owned action and sends no replaceable moderation target", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      Response.json(
        init?.method === "POST"
          ? { id: actionId, status: "APPLIED", receipt: { actionId, commentId: cursor } }
          : turn(),
      ),
    );
    await expect(
      runCli([
        "assistant",
        "decide",
        conversationId,
        actionId,
        "--request-id",
        turnRequestId,
        "--decision",
        "CONFIRM",
        "--json",
      ]),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
    const result = await runCli([
      "assistant",
      "decide",
      conversationId,
      actionId,
      "--request-id",
      turnRequestId,
      "--decision",
      "CONFIRM",
      "--yes",
    ]);
    expect(result).toMatchObject({ status: "APPLIED", receipt: { actionId } });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(urlOf(url)).toBe(`https://blog.example${base}/actions/${actionId}/decision`);
    expect(bodyOf(init)).toEqual({ decision: "CONFIRM" });
  });

  it("preserves an uncertain action decision and does not retry or flip it", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") throw new TypeError("Lost response");
      return Response.json({
        conversation: { id: conversationId },
        turns: [turn()],
        nextBefore: null,
      });
    });
    await expect(
      runCli(["assistant", "decide", conversationId, actionId, "--decision", "REJECT", "--yes"]),
    ).rejects.toMatchObject({
      code: "ASSISTANT_DECISION_UNKNOWN",
      message: expect.stringContaining("REJECT"),
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("rejects forged or oversized run input before opening a stream", async () => {
    await expect(runCli(["assistant", "run", "..", "--message", "hello"])).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(
      runCli(["assistant", "run", conversationId, "--message", "x".repeat(2001)]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      runCli(["assistant", "run", conversationId, "--message", "hello", "--request-id", "x/y"]),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
