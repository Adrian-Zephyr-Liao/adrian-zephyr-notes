import type { AdminAgentInteractionEvent } from "@adrian-zephyr-notes/contracts";
import { toTextContentFromAdminAgentInteractionEvent } from "./admin-agent-copilotkit-events.mapper";

describe("admin agent CopilotKit event mapper", () => {
  it("maps text deltas to public assistant text", () => {
    const event = {
      createdAt: "2026-07-05T00:00:01.000Z",
      delta: "正在读取今日可见评论。",
      id: "delta-1",
      messageId: "message-1",
      type: "textDelta",
    } satisfies AdminAgentInteractionEvent;

    expect(toTextContentFromAdminAgentInteractionEvent(event)).toBe("正在读取今日可见评论。");
  });
});
