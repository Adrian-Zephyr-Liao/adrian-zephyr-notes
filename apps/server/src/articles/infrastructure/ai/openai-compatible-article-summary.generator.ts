import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ArticleSummaryGenerator,
  GenerateArticleSummaryInput,
} from "../../domain/article-summary-generator";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const defaultBaseUrl = "https://api.openai.com/v1";
const maxMarkdownCharacters = 24000;
const minimaxProvider = "minimax";

@Injectable()
class OpenAiCompatibleArticleSummaryGenerator implements ArticleSummaryGenerator {
  constructor(private readonly configService: ConfigService) {}

  isEnabled() {
    return Boolean(this.getApiKey() && this.getModel());
  }

  async generate(input: GenerateArticleSummaryInput) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey || !model) {
      throw new Error("LLM_API_KEY and LLM_MODEL are required to generate article AI summaries.");
    }

    const response = await fetch(this.getChatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildChatCompletionRequestBody(model, input, this.getProvider())),
    });

    if (!response.ok) {
      throw new Error(
        `Article AI summary request failed: ${response.status} ${await readErrorBody(response)}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Article AI summary response did not include message content.");
    }

    return {
      provider: this.getProvider(),
      model,
      text: extractSummaryText(content),
    };
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
}

function buildChatCompletionRequestBody(
  model: string,
  input: GenerateArticleSummaryInput,
  provider: string,
) {
  return {
    model,
    temperature: 0.2,
    max_completion_tokens: 600,
    ...(provider === minimaxProvider ? { thinking: { type: "disabled" } } : {}),
    messages: [
      {
        role: "system",
        content: "你是一个严谨的技术博客导读编辑。只基于给定文章内容生成面向读者的中文摘要。",
      },
      {
        role: "user",
        content: buildPrompt(input),
      },
    ],
  };
}

function buildPrompt(input: GenerateArticleSummaryInput) {
  return [
    "请为下面文章生成一段 80-160 个中文字符的导读摘要。",
    "要求：说明文章主要讲什么、读者能快速获得什么；不要编造正文没有的信息；不要输出标题；只输出 JSON。",
    'JSON 结构：{"summary":"摘要正文"}',
    "",
    `标题：${input.title}`,
    `原 description：${input.description}`,
    "正文 Markdown：",
    input.markdown.slice(0, maxMarkdownCharacters),
  ].join("\n");
}

function extractSummaryText(content: string) {
  const normalized = stripCodeFence(stripThinkBlocks(content).trim());

  try {
    const parsed = JSON.parse(normalized) as { summary?: unknown };

    if (typeof parsed.summary === "string" && parsed.summary.trim()) {
      return parsed.summary.trim();
    }
  } catch {
    // Some OpenAI-compatible providers ignore JSON-only instructions. A plain text fallback keeps
    // the worker useful while the application use case still normalizes and validates the result.
  }

  return normalized;
}

function stripThinkBlocks(value: string) {
  return value.replaceAll(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function readErrorBody(response: Response) {
  const body = await response.text().catch(() => "");
  return body.trim().slice(0, 500);
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export {
  OpenAiCompatibleArticleSummaryGenerator,
  buildChatCompletionRequestBody,
  extractSummaryText,
};
