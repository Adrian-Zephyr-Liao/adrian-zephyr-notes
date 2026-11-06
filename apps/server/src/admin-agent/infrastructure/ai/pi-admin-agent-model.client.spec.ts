import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PiAdminAgentModelClient } from "./pi-admin-agent-model.client";

describe("PiAdminAgentModelClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes conservative default token budgets and configured overrides", () => {
    const defaults = configured();
    expect(defaults.contextWindow).toBe(32768);
    expect(defaults.maxOutputTokens).toBe(8192);

    const custom = configured({ LLM_CONTEXT_WINDOW: "65536", LLM_MAX_TOKENS: "4096" });
    expect(custom.contextWindow).toBe(65536);
    expect(custom.maxOutputTokens).toBe(4096);
  });

  it("uses pi-ai for the configured endpoint and retains MiniMax request options", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response([
          { choices: [{ delta: { content: "完成" }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: "stop" }] },
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    const client = configured({
      LLM_PROVIDER: "minimax",
      LLM_BASE_URL: "https://api.minimaxi.com/v1",
    });
    expect(
      await client.complete({
        messages: [{ role: "user", content: "请总结" }],
        maxCompletionTokens: 123,
      }),
    ).toBe("完成");
    expect(client.modelRef).toEqual({ provider: "minimax", modelId: "test-model" });
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.minimaxi.com/v1/chat/completions");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      model: "test-model",
      max_completion_tokens: 123,
      stream: true,
      reasoning_split: true,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: "请总结" }],
    });
  });

  it("preserves MiniMax text and thinking deltas in persisted content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response([
            { choices: [{ delta: { reasoning_content: "检查" } }] },
            { choices: [{ delta: { reasoning_content: "评论" } }] },
            { choices: [{ delta: { content: "已" } }] },
            { choices: [{ delta: { content: "完成" } }] },
            { choices: [{ delta: {}, finish_reason: "stop" }] },
          ]),
        ),
    );
    const client = configured({ LLM_PROVIDER: "minimax" });
    await client.ready();
    const model = client.models.getModel(client.modelRef.provider, client.modelRef.modelId)!;
    const stream = client.models.streamSimple(model, {
      messages: [{ role: "user", content: "test", timestamp: 1 }],
    });
    const text: string[] = [];
    const thinking: string[] = [];
    for await (const event of stream) {
      if (event.type === "text_delta") text.push(event.delta);
      if (event.type === "thinking_delta") thinking.push(event.delta);
    }
    expect(text.join("")).toBe("已完成");
    expect(thinking.join("")).toBe("检查评论");
    expect((await stream.result()).content).toMatchObject([
      { type: "thinking", thinking: "检查评论" },
      { type: "text", text: "已完成" },
    ]);
  });

  it("preserves repeated MiniMax text and thinking deltas", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response([
            { choices: [{ delta: { reasoning_content: "想" } }] },
            { choices: [{ delta: { reasoning_content: "想" } }] },
            { choices: [{ delta: { content: "哈" } }] },
            { choices: [{ delta: { content: "哈" } }] },
            { choices: [{ delta: {}, finish_reason: "stop" }] },
          ]),
        ),
    );
    const client = configured({ LLM_PROVIDER: "minimax" });
    await client.ready();
    const model = client.models.getModel(client.modelRef.provider, client.modelRef.modelId)!;
    const stream = client.models.streamSimple(model, {
      messages: [{ role: "user", content: "test", timestamp: 1 }],
    });
    const text: string[] = [];
    const thinking: string[] = [];
    for await (const event of stream) {
      if (event.type === "text_delta") text.push(event.delta);
      if (event.type === "thinking_delta") thinking.push(event.delta);
    }
    expect(text).toEqual(["哈", "哈"]);
    expect(thinking).toEqual(["想", "想"]);
    expect((await stream.result()).content).toMatchObject([
      { type: "thinking", thinking: "想想" },
      { type: "text", text: "哈哈" },
    ]);
  });

  it("filters split think tags while preserving ordinary text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response([
            { choices: [{ delta: { content: "公开<thi" } }] },
            { choices: [{ delta: { content: "nk>内部推理</thi" } }] },
            { choices: [{ delta: { content: "nk>回复" } }] },
            { choices: [{ delta: {}, finish_reason: "stop" }] },
          ]),
        ),
    );
    expect(await configured().complete({ messages: [{ role: "user", content: "test" }] })).toBe(
      "公开回复",
    );
  });

  it("delegates tool argument assembly and tool results to pi-ai", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-1",
                      type: "function",
                      function: { name: "search_comments", arguments: '{"query":' },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              { delta: { tool_calls: [{ index: 0, function: { arguments: '"spam"}' } }] } },
            ],
          },
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      ),
    );
    const client = configured();
    await client.ready();
    const model = client.models.getModel(client.modelRef.provider, client.modelRef.modelId)!;
    const answer = await client.models.completeSimple(model, {
      messages: [{ role: "user", content: "test", timestamp: 1 }],
      tools: [
        {
          name: "search_comments",
          description: "Search",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
      ],
    });
    expect(answer.stopReason).toBe("toolUse");
    expect(answer.content).toMatchObject([
      { type: "toolCall", id: "call-1", name: "search_comments", arguments: { query: "spam" } },
    ]);
  });

  it("does not hide provider failures or retry requests below the durable runtime", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "quota denied" } }), { status: 403 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      configured().complete({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow("403");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("propagates cancellation to the provider request", async () => {
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    let receivedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init: RequestInit) => {
        receivedSignal = init.signal ?? undefined;
        start();
        return new Promise<Response>((_resolve, reject) => {
          receivedSignal!.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        });
      }),
    );
    const abort = new AbortController();
    const pending = configured().complete({
      messages: [{ role: "user", content: "test" }],
      signal: abort.signal,
    });
    await started;
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("reports missing configuration before sending a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = new PiAdminAgentModelClient(new ConfigService({}));
    await expect(client.complete({ messages: [] })).rejects.toThrow("LLM_API_KEY and LLM_MODEL");
    expect(fetch).not.toHaveBeenCalled();
  });
});

function configured(extra: Record<string, string> = {}) {
  return new PiAdminAgentModelClient(
    new ConfigService({ LLM_API_KEY: "test-key", LLM_MODEL: "test-model", ...extra }),
  );
}

function response(chunks: unknown[]) {
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
    {
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}
