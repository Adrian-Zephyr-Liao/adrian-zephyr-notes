import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleChatCompletionClient } from "./openai-compatible-chat-completion.client";

describe("OpenAiCompatibleChatCompletionClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("streams OpenAI-compatible delta content while filtering think blocks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        createTextStream([
          toDataFrame({ choices: [{ delta: { content: "公开" } }] }),
          toDataFrame({ choices: [{ delta: { content: "<think>内部" } }] }),
          toDataFrame({ choices: [{ delta: { content: "推理</think>回复" } }] }),
          "data: [DONE]\n\n",
        ]),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenAiCompatibleChatCompletionClient(
      createConfigService({
        LLM_API_KEY: "test-key",
        LLM_MODEL: "test-model",
      }),
    );

    await expect(
      collectAsyncIterable(
        client.stream({
          messages: [{ content: "Hello", role: "user" }],
        }),
      ),
    ).resolves.toEqual(["公开", "回复"]);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      messages: [{ content: "Hello", role: "user" }],
      model: "test-model",
      stream: true,
    });
  });

  it("uses a longer default timeout for streaming agent replies", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(createTextStream(["data: [DONE]\n\n"]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenAiCompatibleChatCompletionClient(
      createConfigService({
        LLM_API_KEY: "test-key",
        LLM_MODEL: "test-model",
      }),
    );

    await collectAsyncIterable(
      client.stream({
        messages: [{ content: "Hello", role: "user" }],
      }),
    );

    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
  });

  it("allows LLM_TIMEOUT_MS to override the default timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(createTextStream(["data: [DONE]\n\n"]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenAiCompatibleChatCompletionClient(
      createConfigService({
        LLM_API_KEY: "test-key",
        LLM_MODEL: "test-model",
        LLM_TIMEOUT_MS: "12345",
      }),
    );

    await collectAsyncIterable(
      client.stream({
        messages: [{ content: "Hello", role: "user" }],
      }),
    );

    expect(timeoutSpy).toHaveBeenCalledWith(12_345);
  });

  it("streams OpenAI-compatible tool call deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        createTextStream([
          toDataFrame({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      function: {
                        name: "show_action_result",
                      },
                      id: "call-1",
                      index: 0,
                      type: "function",
                    },
                  ],
                },
              },
            ],
          }),
          toDataFrame({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      function: {
                        arguments: '{"title":"OK"}',
                      },
                      index: 0,
                    },
                  ],
                },
              },
            ],
          }),
          "data: [DONE]\n\n",
        ]),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenAiCompatibleChatCompletionClient(
      createConfigService({
        LLM_API_KEY: "test-key",
        LLM_MODEL: "test-model",
      }),
    );

    await expect(
      collectAsyncIterable(
        client.streamEvents({
          messages: [{ content: "Hello", role: "user" }],
          tools: [
            {
              function: {
                description: "Render result",
                name: "show_action_result",
                parameters: { type: "object" },
              },
              type: "function",
            },
          ],
        }),
      ),
    ).resolves.toEqual([
      {
        id: "call-1",
        index: 0,
        name: "show_action_result",
        type: "toolCallDelta",
      },
      {
        argumentsDelta: '{"title":"OK"}',
        index: 0,
        type: "toolCallDelta",
      },
    ]);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      tool_choice: "auto",
      tools: [
        {
          function: {
            name: "show_action_result",
          },
          type: "function",
        },
      ],
    });
  });
});

function createConfigService(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key];
    },
  } as never;
}

function createTextStream(chunks: string[]) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

function toDataFrame(value: unknown) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];

  for await (const value of iterable) {
    values.push(value);
  }

  return values;
}
