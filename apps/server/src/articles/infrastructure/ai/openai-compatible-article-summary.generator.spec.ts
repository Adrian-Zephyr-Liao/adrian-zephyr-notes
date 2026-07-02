import { describe, expect, it } from "vitest";
import {
  buildChatCompletionRequestBody,
  extractSummaryText,
} from "./openai-compatible-article-summary.generator";

describe("OpenAI-compatible article summary generator helpers", () => {
  it("adds MiniMax M3 thinking control only for the minimax provider", () => {
    expect(buildChatCompletionRequestBody("MiniMax-M3", createInput(), "minimax")).toMatchObject({
      model: "MiniMax-M3",
      thinking: { type: "disabled" },
      max_completion_tokens: 600,
    });

    expect(
      buildChatCompletionRequestBody("gpt-4.1-mini", createInput(), "openai-compatible"),
    ).not.toHaveProperty("thinking");
  });

  it("extracts JSON summaries after stripping MiniMax thinking tags", () => {
    expect(extractSummaryText('<think>分析过程</think>\n{"summary":"这是一段摘要。"}')).toBe(
      "这是一段摘要。",
    );
  });
});

function createInput() {
  return {
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
  };
}
