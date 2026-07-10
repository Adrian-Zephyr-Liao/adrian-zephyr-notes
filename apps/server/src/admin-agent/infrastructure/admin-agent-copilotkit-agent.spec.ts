import { EventType, type RunAgentInput } from "@ag-ui/client";
import { lastValueFrom, toArray } from "rxjs";
import { AdminAgentCopilotKitAgent } from "./admin-agent-copilotkit-agent";

describe("AdminAgentCopilotKitAgent", () => {
  it("does not emit component state snapshots for ordinary chat", async () => {
    const agent = new AdminAgentCopilotKitAgent({
      sendChatMessage: {
        stream: async function* () {
          yield {
            createdAt: "2026-07-04T10:00:01.000Z",
            delta: "当前评论上下文已进入普通 chat stream。",
            id: "chat-delta-1",
            messageId: "message-1",
            type: "textDelta",
          };
        },
      },
    } as never);

    const events = await lastValueFrom(agent.run(createChatAgentInput()).pipe(toArray()));

    expect(events.some((event) => event.type === EventType.STATE_SNAPSHOT)).toBe(false);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delta: "当前评论上下文已进入普通 chat stream。",
          type: EventType.TEXT_MESSAGE_CONTENT,
        }),
      ]),
    );
  });

  it("ignores forwarded runType and streams as ordinary chat", async () => {
    const stream = vi.fn(async function* () {
      yield {
        createdAt: "2026-07-04T10:00:01.000Z",
        delta: "我会按普通对话处理这次请求。",
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta" as const,
      };
    });
    const agent = new AdminAgentCopilotKitAgent({
      sendChatMessage: { stream },
    } as never);

    const events = await lastValueFrom(agent.run(createRunAgentInput()).pipe(toArray()));

    expect(stream).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      context: [
        {
          description: "当前评论治理队列的聚合状态。",
          id: "comments.summary",
          title: "评论治理上下文",
          value: '{"pendingFindingCount":2}',
        },
      ],
      message: "分析今日评论",
      persistUserMessage: true,
      recentMessages: [],
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: EventType.TEXT_MESSAGE_START }),
        expect.objectContaining({
          delta: "我会按普通对话处理这次请求。",
          type: EventType.TEXT_MESSAGE_CONTENT,
        }),
        expect.objectContaining({ type: EventType.TEXT_MESSAGE_END }),
      ]),
    );
  });

  it("passes only prior dialog turns as recent chat history", async () => {
    const stream = vi.fn(async function* () {
      yield {
        createdAt: "2026-07-04T10:00:01.000Z",
        delta: "继续。",
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta" as const,
      };
    });
    const agent = new AdminAgentCopilotKitAgent({
      sendChatMessage: { stream },
    } as never);

    await lastValueFrom(agent.run(createFollowUpAgentInput()).pipe(toArray()));

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "thread-1",
        message: "接下来怎么做？",
        persistUserMessage: true,
        recentMessages: [
          {
            content: "进入文章工作台",
            role: "user",
          },
          {
            content: "我会先通过对话澄清。",
            role: "assistant",
          },
        ],
      }),
    );
  });

  it("keeps tool-result continuations in the same conversation without persisting them as user input", async () => {
    const stream = vi.fn(async function* () {
      yield {
        createdAt: "2026-07-04T10:00:01.000Z",
        delta: "已继续处理。",
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta" as const,
      };
    });
    const agent = new AdminAgentCopilotKitAgent({
      sendChatMessage: { stream },
    } as never);

    await lastValueFrom(agent.run(createToolContinuationAgentInput()).pipe(toArray()));

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "thread-1",
        message: "请根据刚刚的工具执行结果，继续以简短中文回复管理员。",
        persistUserMessage: false,
      }),
    );
  });
});

function createRunAgentInput(): RunAgentInput {
  return {
    context: [
      {
        description: "comments.summary\n评论治理上下文\n当前评论治理队列的聚合状态。",
        value: '{"pendingFindingCount":2}',
      },
    ],
    forwardedProps: {
      conversationId: "conversation-1",
      runType: "COMMENT_MODERATION_TODAY",
    },
    messages: [
      {
        content: "分析今日评论",
        id: "message-user-1",
        role: "user",
      },
    ],
    runId: "run-1",
    state: {},
    threadId: "thread-1",
    tools: [],
  };
}

function createChatAgentInput(): RunAgentInput {
  return {
    context: [],
    forwardedProps: {},
    messages: [
      {
        content: "分析今日评论",
        id: "message-user-1",
        role: "user",
      },
    ],
    runId: "run-1",
    state: {},
    threadId: "thread-1",
    tools: [],
  };
}

function createFollowUpAgentInput(): RunAgentInput {
  return {
    context: [],
    forwardedProps: {},
    messages: [
      {
        content: "进入文章工作台",
        id: "message-user-1",
        role: "user",
      },
      {
        content: "我会先通过对话澄清。",
        id: "message-assistant-1",
        role: "assistant",
      },
      {
        content: "接下来怎么做？",
        id: "message-user-2",
        role: "user",
      },
    ],
    runId: "run-2",
    state: {},
    threadId: "thread-1",
    tools: [],
  };
}

function createToolContinuationAgentInput(): RunAgentInput {
  return {
    context: [],
    forwardedProps: {},
    messages: [
      {
        content: "分析今日评论",
        id: "message-user-1",
        role: "user",
      },
      {
        content: "",
        id: "message-assistant-1",
        role: "assistant",
        toolCalls: [
          {
            function: {
              arguments: '{"taskName":"comment_moderation_analysis"}',
              name: "start_admin_agent_task",
            },
            id: "tool-call-1",
            type: "function",
          },
        ],
      } as never,
      {
        content: '{"status":"completed"}',
        id: "message-tool-1",
        role: "tool",
        toolCallId: "tool-call-1",
      } as never,
    ],
    runId: "run-3",
    state: {},
    threadId: "thread-1",
    tools: [],
  };
}
