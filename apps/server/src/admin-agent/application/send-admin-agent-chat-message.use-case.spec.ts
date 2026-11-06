import { describe, expect, it, vi } from "vitest";
import type { AdminAgentChatRunnerEvent } from "../domain/admin-agent-chat-runner";
import { SendAdminAgentChatMessageUseCase } from "./send-admin-agent-chat-message.use-case";

describe("SendAdminAgentChatMessageUseCase", () => {
  it("rejects another administrator's conversation before persisting user input or running a model", async () => {
    const streamReply = vi.fn();
    const recordMessage = vi.fn();
    const assertConversationAccess = vi
      .fn()
      .mockRejectedValue(new Error("Conversation belongs to another administrator"));
    const useCase = new SendAdminAgentChatMessageUseCase({ streamReply }, {
      recordMessage,
      assertConversationAccess,
    } as never);
    const collect = async () => {
      for await (const _event of useCase.stream({
        actorUserId: "other-admin",
        assistantMessageId: "assistant-1",
        reasoningMessageId: "reasoning-1",
        userMessageId: "user-1",
        conversationId: "conversation-1",
        message: "Hello",
      })) {
        /* consume */
      }
    };
    await expect(collect()).rejects.toThrow("another administrator");
    expect(recordMessage).not.toHaveBeenCalled();
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("persists reasoning as a separate AG-UI history message before the assistant response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T10:00:00.000Z"));
    const recordMessage = vi.fn().mockResolvedValue(undefined);
    const useCase = new SendAdminAgentChatMessageUseCase(
      {
        streamReply: () =>
          toTimedAsyncIterable(
            [
              { delta: "先确认数据范围，", type: "reasoningDelta" },
              { delta: "再汇总关键指标。", type: "reasoningDelta" },
              { delta: "分析完成。", type: "textDelta" },
            ],
            65_000,
          ),
      },
      { recordMessage } as never,
    );

    const events: AdminAgentChatRunnerEvent[] = [];

    for await (const event of useCase.stream({
      assistantMessageId: "assistant-1",
      conversationId: "conversation-1",
      message: "分析今天的数据",
      reasoningMessageId: "reasoning-1",
      userMessageId: "user-1",
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { delta: "先确认数据范围，", type: "reasoningDelta" },
      { delta: "再汇总关键指标。", type: "reasoningDelta" },
      { delta: "分析完成。", type: "textDelta" },
    ]);
    expect(recordMessage.mock.calls.map(([input]) => input)).toEqual([
      {
        actorUserId: null,
        conversationId: "conversation-1",
        message: {
          content: "分析今天的数据",
          id: "user-1",
          role: "user",
        },
      },
      {
        actorUserId: null,
        conversationId: "conversation-1",
        durationMs: 65_000,
        message: {
          content: "先确认数据范围，再汇总关键指标。",
          id: "reasoning-1",
          role: "reasoning",
        },
      },
      {
        actorUserId: null,
        conversationId: "conversation-1",
        message: {
          content: "分析完成。",
          id: "assistant-1",
          role: "assistant",
        },
      },
    ]);
    vi.useRealTimers();
  });
});

function toTimedAsyncIterable(
  events: AdminAgentChatRunnerEvent[],
  reasoningDurationMs: number,
): AsyncIterable<AdminAgentChatRunnerEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        if (event.type !== "reasoningDelta") {
          vi.advanceTimersByTime(reasoningDurationMs);
        }

        yield event;
      }
    },
  };
}
