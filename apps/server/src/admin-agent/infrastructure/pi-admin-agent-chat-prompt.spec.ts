import { describe, expect, it } from "vitest";
import { buildAdminAgentChatSystemPrompt } from "./pi-admin-agent-chat-prompt";
describe("buildAdminAgentChatSystemPrompt", () => {
  it("requires Simplified Chinese execution summaries and explicit write authorization", () => {
    const prompt = buildAdminAgentChatSystemPrompt();
    expect(prompt).toContain("reasoning 必须始终只使用简体中文");
    expect(prompt).toContain("即使管理员使用其他语言");
    expect(prompt).toContain("只有管理员在对话里明确要求隐藏分析结果中的评论时");
  });
});
