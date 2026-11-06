import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Model, Models } from "@earendil-works/pi-ai";

@Injectable()
export class PiAssistantModelClient {
  private opening?: Promise<Models>;
  readonly model: Model<"openai-completions">;
  readonly maxOutputTokens: number;

  constructor(private readonly config: ConfigService) {
    const provider = config.get<string>("LLM_PROVIDER")?.trim() || "openai-compatible";
    const id = config.get<string>("LLM_MODEL")?.trim() || "unconfigured";
    this.maxOutputTokens = integer(config.get("LLM_MAX_TOKENS"), 4096, 256, 16384);
    this.model = {
      id,
      name: id,
      provider,
      api: "openai-completions",
      baseUrl: config.get<string>("LLM_BASE_URL")?.trim() || "https://api.openai.com/v1",
      contextWindow: integer(config.get("LLM_CONTEXT_WINDOW"), 32768, 4096, 1000000),
      maxTokens: this.maxOutputTokens,
      reasoning: provider === "minimax",
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: {
        supportsDeveloperRole: false,
        supportsStore: false,
        supportsReasoningEffort: false,
        maxTokensField: "max_completion_tokens",
      },
    };
    if (this.model.contextWindow <= this.maxOutputTokens)
      throw new Error("Assistant model token budget leaves no room for input.");
  }

  isConfigured() {
    return Boolean(
      this.config.get<string>("LLM_API_KEY")?.trim() &&
      this.config.get<string>("LLM_MODEL")?.trim(),
    );
  }
  assertConfigured() {
    if (!this.isConfigured()) throw new Error("Assistant model is not configured.");
  }
  ready() {
    return (this.opening ??= this.open());
  }

  private async open() {
    // Native dynamic imports preserve the ESM-only Pi exports in Nest's CommonJS build.
    const [{ createModels, createProvider }, { openAICompletionsApi }] = await Promise.all([
      import("@earendil-works/pi-ai"),
      import("@earendil-works/pi-ai/api/openai-completions.lazy"),
    ]);
    const models = createModels();
    models.setProvider(
      createProvider({
        id: this.model.provider,
        models: [this.model],
        api: openAICompletionsApi(),
        auth: {
          apiKey: {
            name: "LLM_API_KEY",
            resolve: async () => {
              const apiKey = this.config.get<string>("LLM_API_KEY")?.trim();
              return apiKey ? { auth: { apiKey }, source: "LLM_API_KEY" } : undefined;
            },
          },
        },
      }),
    );
    return models;
  }

  requestOptions() {
    return {
      maxTokens: this.maxOutputTokens,
      timeoutMs: integer(this.config.get("LLM_TIMEOUT_MS"), 60000, 1000, 300000),
      maxRetries: 0,
      onPayload:
        this.model.provider === "minimax"
          ? (payload: unknown) => {
              if (!payload || typeof payload !== "object" || Array.isArray(payload))
                throw new Error("Invalid model payload.");
              return { ...payload, reasoning_split: true, thinking: { type: "adaptive" } };
            }
          : undefined,
    };
  }
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error("Invalid assistant model budget configuration.");
  return parsed;
}
