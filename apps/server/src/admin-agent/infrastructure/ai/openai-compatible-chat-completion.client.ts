import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type OpenAiCompatibleChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiCompatibleChatMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAiCompatibleChatToolCall[];
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

type OpenAiCompatibleChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiCompatibleChatCompletionInput = {
  messages: OpenAiCompatibleChatMessage[];
  maxCompletionTokens?: number;
  temperature?: number;
  tools?: OpenAiCompatibleChatTool[];
};

type OpenAiCompatibleChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAiCompatibleChatCompletionStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string | null;
        };
      }>;
    };
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAiCompatibleChatCompletionStreamEvent =
  | {
      type: "contentDelta";
      delta: string;
    }
  | {
      type: "toolCallDelta";
      index: number;
      id?: string;
      name?: string;
      argumentsDelta?: string;
    };

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultTimeoutMs = 60_000;
const minimaxProvider = "minimax";

@Injectable()
class OpenAiCompatibleChatCompletionClient {
  constructor(private readonly configService: ConfigService) {}

  async complete(input: OpenAiCompatibleChatCompletionInput) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey || !model) {
      throw new Error("LLM_API_KEY and LLM_MODEL are required to run admin agent chat.");
    }

    const response = await fetch(this.getChatCompletionsUrl(), {
      body: JSON.stringify({
        max_completion_tokens: input.maxCompletionTokens ?? 800,
        messages: input.messages,
        model,
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tool_choice: "auto", tools: input.tools } : {}),
        ...(this.getProvider() === minimaxProvider ? { thinking: { type: "disabled" } } : {}),
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(this.getTimeoutMs()),
    });

    if (!response.ok) {
      throw new Error(
        `Admin agent LLM request failed: ${response.status} ${await readErrorBody(response)}`,
      );
    }

    const data = (await response.json()) as OpenAiCompatibleChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Admin agent LLM response did not include message content.");
    }

    return stripThinkBlocks(content);
  }

  async *stream(input: OpenAiCompatibleChatCompletionInput): AsyncIterable<string> {
    for await (const event of this.streamEvents(input)) {
      if (event.type === "contentDelta") {
        yield event.delta;
      }
    }
  }

  async *streamEvents(
    input: OpenAiCompatibleChatCompletionInput,
  ): AsyncIterable<OpenAiCompatibleChatCompletionStreamEvent> {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey || !model) {
      throw new Error("LLM_API_KEY and LLM_MODEL are required to run admin agent chat.");
    }

    const response = await fetch(this.getChatCompletionsUrl(), {
      body: JSON.stringify({
        max_completion_tokens: input.maxCompletionTokens ?? 800,
        messages: input.messages,
        model,
        stream: true,
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tool_choice: "auto", tools: input.tools } : {}),
        ...(this.getProvider() === minimaxProvider ? { thinking: { type: "disabled" } } : {}),
      }),
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(this.getTimeoutMs()),
    });

    if (!response.ok) {
      throw new Error(
        `Admin agent LLM request failed: ${response.status} ${await readErrorBody(response)}`,
      );
    }

    if (!response.body) {
      throw new Error("Admin agent LLM response did not include a readable stream.");
    }

    const decoder = new TextDecoder();
    const thinkBlockFilter = createThinkBlockStreamFilter();
    let lineBuffer = "";

    for await (const chunk of readResponseBody(response.body)) {
      lineBuffer += decoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const events = parseChatCompletionStreamEventsLine(line);

        if (events === "[DONE]") {
          const finalToken = thinkBlockFilter.flush();

          if (finalToken) {
            yield {
              delta: finalToken,
              type: "contentDelta",
            };
          }

          return;
        }

        if (!events) {
          continue;
        }

        for (const event of events) {
          if (event.type === "toolCallDelta") {
            yield event;
            continue;
          }

          const filteredToken = thinkBlockFilter.push(event.delta);

          if (filteredToken) {
            yield {
              delta: filteredToken,
              type: "contentDelta",
            };
          }
        }
      }
    }

    const finalDecoderChunk = decoder.decode();
    const trailingEvents = parseChatCompletionStreamEventsLine(`${lineBuffer}${finalDecoderChunk}`);

    if (trailingEvents && trailingEvents !== "[DONE]") {
      for (const event of trailingEvents) {
        if (event.type === "toolCallDelta") {
          yield event;
          continue;
        }

        const filteredToken = thinkBlockFilter.push(event.delta);

        if (filteredToken) {
          yield {
            delta: filteredToken,
            type: "contentDelta",
          };
        }
      }
    }

    const finalToken = thinkBlockFilter.flush();

    if (finalToken) {
      yield {
        delta: finalToken,
        type: "contentDelta",
      };
    }
  }

  private getApiKey() {
    return this.configService.get<string>("LLM_API_KEY")?.trim();
  }

  private getModel() {
    return this.configService.get<string>("LLM_MODEL")?.trim();
  }

  private getProvider() {
    return this.configService.get<string>("LLM_PROVIDER")?.trim() || "openai-compatible";
  }

  private getChatCompletionsUrl() {
    const baseUrl = this.configService.get<string>("LLM_BASE_URL")?.trim() || defaultBaseUrl;
    return new URL("chat/completions", withTrailingSlash(baseUrl)).toString();
  }

  private getTimeoutMs() {
    const configuredTimeout = Number(this.configService.get<string>("LLM_TIMEOUT_MS"));

    if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
      return configuredTimeout;
    }

    return defaultTimeoutMs;
  }
}

async function readErrorBody(response: Response) {
  const body = await response.text().catch(() => "");
  return body.trim().slice(0, 500);
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function stripThinkBlocks(value: string) {
  return value.replaceAll(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function* readResponseBody(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseChatCompletionStreamLine(line: string) {
  const events = parseChatCompletionStreamEventsLine(line);

  if (events === "[DONE]") {
    return "[DONE]";
  }

  return (
    events?.flatMap((event) => (event.type === "contentDelta" ? [event.delta] : [])).join("") ||
    null
  );
}

function parseChatCompletionStreamEventsLine(
  line: string,
): OpenAiCompatibleChatCompletionStreamEvent[] | "[DONE]" | null {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("data:")) {
    return null;
  }

  const payload = trimmedLine.slice("data:".length).trim();

  if (!payload || payload === "[DONE]") {
    return payload === "[DONE]" ? "[DONE]" : null;
  }

  try {
    const chunk = JSON.parse(payload) as OpenAiCompatibleChatCompletionStreamChunk;
    return extractStreamChunkEvents(chunk);
  } catch {
    return null;
  }
}

function extractStreamChunkEvents(
  chunk: OpenAiCompatibleChatCompletionStreamChunk,
): OpenAiCompatibleChatCompletionStreamEvent[] {
  return (
    chunk.choices?.flatMap((choice) => {
      const events: OpenAiCompatibleChatCompletionStreamEvent[] = [];
      const content = choice.delta?.content ?? choice.message?.content ?? "";

      if (content) {
        events.push({
          delta: content,
          type: "contentDelta",
        });
      }

      for (const toolCall of choice.delta?.tool_calls ?? []) {
        events.push({
          index: toolCall.index ?? 0,
          type: "toolCallDelta",
          ...(toolCall.function?.arguments ? { argumentsDelta: toolCall.function.arguments } : {}),
          ...(toolCall.id ? { id: toolCall.id } : {}),
          ...(toolCall.function?.name ? { name: toolCall.function.name } : {}),
        });
      }

      return events;
    }) ?? []
  );
}

function createThinkBlockStreamFilter() {
  let buffer = "";
  let isInsideThinkBlock = false;

  return {
    push(chunk: string) {
      buffer += chunk;
      let output = "";

      while (buffer) {
        if (isInsideThinkBlock) {
          const endIndex = buffer.toLowerCase().indexOf("</think>");

          if (endIndex === -1) {
            buffer = keepPossibleTagPrefix(buffer, "</think>");
            return output;
          }

          buffer = buffer.slice(endIndex + "</think>".length);
          isInsideThinkBlock = false;
          continue;
        }

        const startIndex = buffer.toLowerCase().indexOf("<think>");

        if (startIndex === -1) {
          const retained = keepPossibleTagPrefix(buffer, "<think>");
          output += buffer.slice(0, buffer.length - retained.length);
          buffer = retained;
          return output;
        }

        output += buffer.slice(0, startIndex);
        buffer = buffer.slice(startIndex + "<think>".length);
        isInsideThinkBlock = true;
      }

      return output;
    },
    flush() {
      if (isInsideThinkBlock) {
        buffer = "";
        return "";
      }

      const output = buffer;
      buffer = "";
      return output;
    },
  };
}

function keepPossibleTagPrefix(value: string, tag: string) {
  const lowerValue = value.toLowerCase();
  const lowerTag = tag.toLowerCase();
  const maxLength = Math.min(value.length, tag.length - 1);

  for (let length = maxLength; length > 0; length -= 1) {
    if (lowerTag.startsWith(lowerValue.slice(-length))) {
      return value.slice(-length);
    }
  }

  return "";
}

export {
  OpenAiCompatibleChatCompletionClient,
  parseChatCompletionStreamEventsLine,
  parseChatCompletionStreamLine,
  stripThinkBlocks,
};
export type {
  OpenAiCompatibleChatCompletionInput,
  OpenAiCompatibleChatCompletionStreamEvent,
  OpenAiCompatibleChatMessage,
  OpenAiCompatibleChatTool,
  OpenAiCompatibleChatToolCall,
};
