import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Model,
  Models,
  ProviderStreams,
  StreamOptions,
} from "@earendil-works/pi-ai";

type PiAdminAgentCompletionInput = {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxCompletionTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

/** Configures pi-ai for the application's existing OpenAI-compatible endpoint. */
@Injectable()
class PiAdminAgentModelClient {
  private modelCollection?: Models;
  private initialization?: Promise<void>;
  readonly modelRef: { provider: string; modelId: string };
  private readonly model: Model<"openai-completions">;

  constructor(private readonly configService: ConfigService) {
    const providerId = configService.get<string>("LLM_PROVIDER")?.trim() || "openai-compatible";
    const modelId = configService.get<string>("LLM_MODEL")?.trim() || "unconfigured";
    const baseUrl =
      configService.get<string>("LLM_BASE_URL")?.trim() || "https://api.openai.com/v1";
    const minimax = providerId === "minimax";
    this.modelRef = { provider: providerId, modelId };
    this.model = {
      api: "openai-completions",
      provider: providerId,
      id: modelId,
      name: modelId,
      baseUrl,
      reasoning: minimax,
      input: ["text"],
      contextWindow: positiveInteger(configService.get<string>("LLM_CONTEXT_WINDOW"), 32768),
      maxTokens: positiveInteger(configService.get<string>("LLM_MAX_TOKENS"), 8192),
      // Custom endpoint pricing is unknown; token counts remain available to the host.
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: {
        supportsDeveloperRole: false,
        supportsStore: false,
        supportsReasoningEffort: false,
        maxTokensField: "max_completion_tokens",
      },
    };
  }

  get models(): Models {
    if (!this.modelCollection)
      throw new Error("Pi model client must be initialized before accessing models.");
    return this.modelCollection;
  }

  ready(): Promise<void> {
    return (this.initialization ??= this.initialize());
  }

  private async initialize() {
    // Pi is ESM-only; preserve native imports when the Nest application emits CommonJS.
    const { createModels, createProvider, lazyStream } = await import("@earendil-works/pi-ai");
    const { openAICompletionsApi } =
      await import("@earendil-works/pi-ai/api/openai-completions.lazy");
    const configService = this.configService;
    const { provider: providerId } = this.modelRef;
    const minimax = providerId === "minimax";
    const api = openAICompletionsApi();
    const requestOptions = (options?: StreamOptions): StreamOptions => ({
      ...options,
      timeoutMs: positiveInteger(configService.get<string>("LLM_TIMEOUT_MS"), 60000),
      // Durable owns retries; SDK retries would obscure attempt and cancellation accounting.
      maxRetries: 0,
      onPayload: async (payload, model) => {
        const transformed = (await options?.onPayload?.(payload, model)) ?? payload;
        if (!minimax) return transformed;
        // This is pi-ai's provider payload boundary, after its normal message/tool conversion.
        if (!transformed || typeof transformed !== "object" || Array.isArray(transformed)) {
          throw new Error("MiniMax request payload must be an object.");
        }
        return { ...transformed, reasoning_split: true, thinking: { type: "adaptive" } };
      },
    });
    const streams: ProviderStreams = {
      stream: (model, context, options) =>
        normalizeProviderStream(
          model,
          api.stream(model, context, requestOptions(options)),
          minimax,
          lazyStream,
        ),
      streamSimple: (model, context, options) =>
        normalizeProviderStream(
          model,
          api.streamSimple(model, context, {
            ...options,
            ...requestOptions(options),
          }),
          minimax,
          lazyStream,
        ),
    };
    const models = createModels();
    models.setProvider(
      createProvider({
        id: providerId,
        baseUrl: this.model.baseUrl,
        models: [this.model],
        auth: {
          apiKey: {
            name: "LLM_API_KEY",
            resolve: async () => {
              const apiKey = configService.get<string>("LLM_API_KEY")?.trim();
              return apiKey ? { auth: { apiKey }, source: "LLM_API_KEY" } : undefined;
            },
          },
        },
        api: streams,
      }),
    );
    this.modelCollection = models;
  }

  async complete(input: PiAdminAgentCompletionInput): Promise<string> {
    this.assertConfigured();
    await this.ready();
    let responseStatus: number | undefined;
    const response = await this.models.complete(
      this.model,
      {
        messages: input.messages.map((message) => ({ ...message, timestamp: Date.now() })),
      },
      {
        maxTokens: input.maxCompletionTokens ?? 800,
        temperature: input.temperature ?? 0.2,
        signal: input.signal,
        onResponse: ({ status }) => {
          responseStatus = status;
        },
      },
    );
    if (response.stopReason === "error" || response.stopReason === "aborted") {
      const error = new Error(response.errorMessage || "Admin agent model request failed.");
      if (response.stopReason === "aborted") error.name = "AbortError";
      if (responseStatus !== undefined && responseStatus >= 400) {
        Object.assign(error, { status: responseStatus });
      }
      throw error;
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new Error("Admin agent LLM response did not include message content.");
    return text;
  }

  assertConfigured() {
    if (
      !this.configService.get<string>("LLM_API_KEY")?.trim() ||
      this.model.id === "unconfigured"
    ) {
      throw new Error("LLM_API_KEY and LLM_MODEL are required to run admin agent chat.");
    }
  }
}

/** Normalizes provider-specific text after pi-ai has parsed the transport and tool protocol. */
function normalizeProviderStream(
  model: Model<string>,
  source: AssistantMessageEventStream,
  cumulative: boolean,
  lazyStream: (
    model: Model<string>,
    setup: () => Promise<AsyncIterable<AssistantMessageEvent>>,
  ) => AssistantMessageEventStream,
): AssistantMessageEventStream {
  return lazyStream(model, async () => {
    async function* events(): AsyncIterable<AssistantMessageEvent> {
      const blocks = new Map<
        number,
        { raw: string; text: string; filter?: ReturnType<typeof createThinkFilter> }
      >();
      const message = (value: AssistantMessage): AssistantMessage => ({
        ...value,
        content: value.content.map((block, index) => {
          const normalized = blocks.get(index);
          if (!normalized) return block;
          if (block.type === "text") return { ...block, text: normalized.text };
          if (block.type === "thinking") return { ...block, thinking: normalized.text };
          return block;
        }),
      });
      for await (const event of source) {
        if (event.type === "text_delta" || event.type === "thinking_delta") {
          const block = blocks.get(event.contentIndex) ?? {
            raw: "",
            text: "",
            ...(event.type === "text_delta" ? { filter: createThinkFilter() } : {}),
          };
          const rawDelta =
            cumulative && event.delta.startsWith(block.raw)
              ? event.delta.slice(block.raw.length)
              : event.delta;
          block.raw =
            cumulative && event.delta.startsWith(block.raw) ? event.delta : block.raw + event.delta;
          const delta = block.filter ? block.filter.push(rawDelta) : rawDelta;
          block.text += delta;
          blocks.set(event.contentIndex, block);
          yield { ...event, delta, partial: message(event.partial) };
        } else if (event.type === "text_end" || event.type === "thinking_end") {
          const block = blocks.get(event.contentIndex);
          if (block?.filter) block.text += block.filter.flush();
          yield {
            ...event,
            content: block?.text ?? event.content,
            partial: message(event.partial),
          };
        } else if (event.type === "done") {
          yield { ...event, message: message(event.message) };
        } else if (event.type === "error") {
          yield { ...event, error: message(event.error) };
        } else if ("partial" in event) {
          yield { ...event, partial: message(event.partial) };
        } else {
          yield event;
        }
      }
    }
    return events();
  });
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Keeps provider-emitted think tags out of the public answer, including split tags. */
function createThinkFilter() {
  let pending = "";
  let hidden = false;
  return {
    push(delta: string) {
      pending += delta;
      let result = "";
      while (pending) {
        const tag = hidden ? "</think>" : "<think>";
        const index = pending.toLowerCase().indexOf(tag);
        if (index >= 0) {
          if (!hidden) result += pending.slice(0, index);
          pending = pending.slice(index + tag.length);
          hidden = !hidden;
          continue;
        }
        let suffix = 0;
        for (let length = 1; length < tag.length && length <= pending.length; length++) {
          if (tag.startsWith(pending.slice(-length).toLowerCase())) suffix = length;
        }
        if (!hidden) result += pending.slice(0, pending.length - suffix);
        pending = suffix ? pending.slice(-suffix) : "";
        break;
      }
      return result;
    },
    flush() {
      const result = hidden ? "" : pending;
      pending = "";
      return result;
    },
  };
}

export { PiAdminAgentModelClient };
export type { PiAdminAgentCompletionInput };
