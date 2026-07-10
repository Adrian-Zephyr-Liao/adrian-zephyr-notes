import { EventType } from "@ag-ui/client";
import type {
  AbstractAgent,
  AgentSubscriberParams,
  TextMessageContentEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
} from "@ag-ui/client";
import { describe, expect, it, vi } from "vitest";
import {
  createAdminAgentSubscriber,
  getInteractionEventStreamKey,
  streamCopilotKitAdminAgentRun,
  toCurrentCopilotKitMessage,
  toRecentCopilotKitMessages,
} from "./agent-copilotkit-client";

describe("agent CopilotKit client", () => {
  it("maps AG-UI text deltas into dialog text events", async () => {
    const onEvent = vi.fn();
    const subscriber = createAdminAgentSubscriber({
      onEvent,
    });

    await subscriber.onTextMessageContentEvent?.({
      ...createSubscriberParams(),
      event: {
        delta: "你好，我在。",
        messageId: "message-1",
        timestamp: Date.parse("2026-07-05T00:00:00.000Z"),
        type: EventType.TEXT_MESSAGE_CONTENT,
      } satisfies TextMessageContentEvent,
      textMessageBuffer: "你好，我在。",
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: "你好，我在。",
        messageId: "message-1",
        type: "textDelta",
      }),
    );
  });

  it("keeps text deltas emitted in the same millisecond", async () => {
    const onEvent = vi.fn();
    const subscriber = createAdminAgentSubscriber({
      onEvent,
    });
    const timestamp = Date.parse("2026-07-05T00:00:00.000Z");

    await subscriber.onTextMessageContentEvent?.({
      ...createSubscriberParams(),
      event: {
        delta: "## 今日评论\n\n",
        messageId: "message-1",
        timestamp,
        type: EventType.TEXT_MESSAGE_CONTENT,
      } satisfies TextMessageContentEvent,
      textMessageBuffer: "## 今日评论\n\n",
    });
    await subscriber.onTextMessageContentEvent?.({
      ...createSubscriberParams(),
      event: {
        delta: "| 评论 | 风险 |\n",
        messageId: "message-1",
        timestamp,
        type: EventType.TEXT_MESSAGE_CONTENT,
      } satisfies TextMessageContentEvent,
      textMessageBuffer: "## 今日评论\n\n| 评论 | 风险 |\n",
    });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls.map(([event]) => event.delta).join("")).toBe(
      "## 今日评论\n\n| 评论 | 风险 |\n",
    );
    expect(onEvent.mock.calls[0]?.[0].id).not.toBe(onEvent.mock.calls[1]?.[0].id);
  });

  it("maps AG-UI tool call boundaries into dialog events", async () => {
    const onEvent = vi.fn();
    const subscriber = createAdminAgentSubscriber({
      onEvent,
    });
    const timestamp = Date.parse("2026-07-05T00:00:00.000Z");

    await subscriber.onToolCallStartEvent?.({
      ...createSubscriberParams(),
      event: {
        timestamp,
        toolCallId: "tool-call-1",
        toolCallName: "ask_user_question",
        type: EventType.TOOL_CALL_START,
      } satisfies ToolCallStartEvent,
    });
    await subscriber.onToolCallEndEvent?.({
      ...createSubscriberParams(),
      event: {
        timestamp,
        toolCallId: "tool-call-1",
        type: EventType.TOOL_CALL_END,
      } satisfies ToolCallEndEvent,
      toolCallArgs: {},
      toolCallName: "ask_user_question",
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "tool-call-1",
        toolCallName: "ask_user_question",
        type: "toolCallStart",
      }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      }),
    );
  });

  it("deduplicates ordinary chat events by event id", () => {
    const firstKey = getInteractionEventStreamKey({
      createdAt: "2026-07-05T00:00:00.000Z",
      delta: "正在分析。",
      id: "delta-1",
      messageId: "message-1",
      type: "textDelta",
    });
    const duplicateKey = getInteractionEventStreamKey({
      createdAt: "2026-07-05T00:00:05.000Z",
      delta: "正在分析。",
      id: "delta-1",
      messageId: "message-1",
      type: "textDelta",
    });

    expect(duplicateKey).toBe(firstKey);
  });

  it("converts recent and current dialog turns to AG-UI messages", () => {
    expect(
      toRecentCopilotKitMessages({
        conversationId: "conversation-1",
        message: "继续",
        recentMessages: [
          { id: "user-1", role: "user", text: "你好" },
          { id: "assistant-1", role: "assistant", text: "你好，我在。" },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ content: "你好", id: "user-1", role: "user" }),
      expect.objectContaining({ content: "你好，我在。", id: "assistant-1", role: "assistant" }),
    ]);
    expect(toCurrentCopilotKitMessage("继续")).toEqual(
      expect.objectContaining({ content: "继续", role: "user" }),
    );
  });

  it("runs chat messages through the CopilotKit provider agent instance", async () => {
    const runAgent = vi.fn(async () => ({ newMessages: [], result: null }));
    const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    const addMessage = vi.fn();
    const setMessages = vi.fn();
    const setState = vi.fn();
    const agent = {
      addMessage,
      subscribe,
      setMessages,
      setState,
    } as unknown as AbstractAgent;
    const copilotkit = {
      runAgent,
    } as unknown as Parameters<typeof streamCopilotKitAdminAgentRun>[0];
    const onEvent = vi.fn();

    await streamCopilotKitAdminAgentRun(
      copilotkit,
      agent,
      {
        conversationId: "conversation-1",
        message: "Hello",
        recentMessages: [],
      },
      {
        onEvent,
      },
    );

    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        onTextMessageContentEvent: expect.any(Function),
      }),
    );
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: "Hello" }));
    expect(setState).toHaveBeenCalledWith({});
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent,
        forwardedProps: {
          conversationId: "conversation-1",
        },
        runId: expect.stringMatching(/^admin-agent-run-/),
      }),
    );
  });
});

function createSubscriberParams(): AgentSubscriberParams {
  return {
    agent: {} as AgentSubscriberParams["agent"],
    input: {
      context: [],
      messages: [],
      runId: "run-1",
      state: {},
      threadId: "thread-1",
      tools: [],
    },
    messages: [],
    state: {},
  };
}
