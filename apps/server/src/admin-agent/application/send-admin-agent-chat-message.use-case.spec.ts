import { describe, expect, it } from "vitest";
import type {
  AdminAgentChatReplyInput,
  AdminAgentChatRunner,
  AdminAgentChatRunnerEvent,
} from "../domain/admin-agent-chat-runner";
import type {
  AdminAgentChatMessageRepository,
  RecordAdminAgentConversationMessageInput,
} from "../domain/admin-agent-chat-message.repository";
import {
  AdminAgentChatValidationError,
  SendAdminAgentChatMessageUseCase,
  normalizeContextEntries,
  normalizeRecentMessages,
} from "./send-admin-agent-chat-message.use-case";

describe("SendAdminAgentChatMessageUseCase", () => {
  it("sends a normalized user message through the LLM chat runner", async () => {
    const runner = new RecordingAdminAgentChatRunner("你好，我在。");
    const useCase = createUseCase(runner);

    const events = await collectAsyncIterable(
      useCase.stream({
        context: [
          {
            description: "评论治理聚合状态",
            id: "comments.summary",
            title: "评论治理上下文",
            value: "pendingFindingCount=2",
          },
        ],
        message: "  Hello  ",
        recentMessages: [
          { content: "上一轮问题", role: "user" },
          { content: "上一轮回复", role: "assistant" },
        ],
      }),
    );

    expect(events).toEqual([
      {
        createdAt: expect.any(String),
        delta: "你好，我在。",
        id: expect.stringContaining("agent-chat-"),
        messageId: expect.stringContaining("agent-chat-"),
        type: "textDelta",
      },
      {
        createdAt: expect.any(String),
        id: expect.stringContaining("agent-chat-"),
        message: {
          content: "你好，我在。",
          role: "assistant",
        },
        type: "textMessage",
      },
    ]);
    expect(runner.lastInput).toEqual({
      context: [
        {
          description: "评论治理聚合状态",
          id: "comments.summary",
          title: "评论治理上下文",
          value: "pendingFindingCount=2",
        },
      ],
      message: "Hello",
      recentMessages: [
        { content: "上一轮问题", role: "user" },
        { content: "上一轮回复", role: "assistant" },
      ],
    });
  });

  it("persists user and assistant messages when a conversation id is available", async () => {
    const runner = new RecordingAdminAgentChatRunner("你好，我在。");
    const repository = new RecordingAdminAgentChatMessageRepository();
    const useCase = createUseCase(runner, repository);

    await collectAsyncIterable(
      useCase.stream({
        actorUserId: "admin-1",
        conversationId: "thread-1",
        message: "  Hello  ",
      }),
    );

    expect(repository.records).toEqual([
      {
        actorUserId: "admin-1",
        content: "Hello",
        conversationId: "thread-1",
        role: "USER",
      },
      {
        actorUserId: null,
        content: "你好，我在。",
        conversationId: "thread-1",
        metadata: null,
        role: "ASSISTANT",
      },
    ]);
  });

  it("persists model tool calls without inventing assistant text", async () => {
    const runner = new RecordingAdminAgentChatRunner([
      {
        toolCallId: "tool-call-1",
        toolCallName: "start_admin_agent_task",
        type: "toolCallStart",
      },
      {
        delta: '{"taskName":"comment_moderation_analysis"}',
        toolCallId: "tool-call-1",
        type: "toolCallArgsDelta",
      },
      {
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      },
    ]);
    const repository = new RecordingAdminAgentChatMessageRepository();
    const useCase = createUseCase(runner, repository);

    await collectAsyncIterable(
      useCase.stream({
        conversationId: "thread-tool",
        message: "分析今日评论",
        tools: [
          {
            description: "Start a registered persisted backend Agent task.",
            name: "start_admin_agent_task",
            parameters: {
              type: "object",
            },
          },
        ],
      }),
    );

    expect(repository.records).toEqual([
      {
        actorUserId: null,
        content: "分析今日评论",
        conversationId: "thread-tool",
        role: "USER",
      },
      {
        actorUserId: null,
        content: "",
        conversationId: "thread-tool",
        metadata: {
          toolCalls: [
            {
              arguments: '{"taskName":"comment_moderation_analysis"}',
              id: "tool-call-1",
              name: "start_admin_agent_task",
            },
          ],
        },
        role: "ASSISTANT",
      },
    ]);
  });

  it("does not persist internal continuation prompts as user messages", async () => {
    const runner = new RecordingAdminAgentChatRunner("已根据工具结果继续。");
    const repository = new RecordingAdminAgentChatMessageRepository();
    const useCase = createUseCase(runner, repository);

    await collectAsyncIterable(
      useCase.stream({
        conversationId: "thread-1",
        message: "请根据刚刚的工具执行结果，继续以简短中文回复管理员。",
        persistUserMessage: false,
      }),
    );

    expect(repository.records).toEqual([
      {
        actorUserId: null,
        content: "已根据工具结果继续。",
        conversationId: "thread-1",
        metadata: null,
        role: "ASSISTANT",
      },
    ]);
  });

  it("rejects empty LLM streams instead of rendering static placeholders", async () => {
    const runner = new RecordingAdminAgentChatRunner([]);
    const useCase = createUseCase(runner);

    await expect(collectAsyncIterable(useCase.stream({ message: "展示入口" }))).rejects.toThrow(
      "Admin agent LLM response did not include message content.",
    );
  });

  it("does not truncate long streamed Markdown replies at the input message limit", async () => {
    const longMarkdown = [
      "# 项目计划",
      "",
      "| 阶段 | 目标 |",
      "| --- | --- |",
      "| 发现 | 明确范围 |",
      "",
      "```text",
      "release-checklist",
      "```",
      "",
      "a".repeat(2600),
    ].join("\n");
    const runner = new RecordingAdminAgentChatRunner(longMarkdown);
    const useCase = createUseCase(runner);

    const events = await collectAsyncIterable(useCase.stream({ message: "输出 Markdown" }));
    const finalMessage = events.find((event) => event.type === "textMessage");

    expect(finalMessage).toMatchObject({
      message: {
        content: longMarkdown,
      },
      type: "textMessage",
    });
  });

  it("rejects empty messages before reaching the LLM", async () => {
    const runner = new RecordingAdminAgentChatRunner("unused");
    const useCase = createUseCase(runner);

    await expect(collectAsyncIterable(useCase.stream({ message: "   " }))).rejects.toBeInstanceOf(
      AdminAgentChatValidationError,
    );
    expect(runner.lastInput).toBeNull();
  });

  it("keeps only the latest non-empty recent messages", () => {
    expect(
      normalizeRecentMessages([
        { content: "  ", role: "assistant" },
        ...Array.from({ length: 9 }, (_, index) => ({
          content: `message-${index + 1}`,
          role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
        })),
      ]).map((message) => message.content),
    ).toEqual([
      "message-2",
      "message-3",
      "message-4",
      "message-5",
      "message-6",
      "message-7",
      "message-8",
      "message-9",
    ]);
  });

  it("normalizes context entries before sending them to the LLM", () => {
    expect(
      normalizeContextEntries([
        {
          description: "  当前评论队列  ",
          id: " comments.summary ",
          title: " 评论治理上下文 ",
          value: " pending=2 ",
        },
        {
          description: "missing value",
          id: "empty",
          title: "Empty",
          value: " ",
        },
      ]),
    ).toEqual([
      {
        description: "当前评论队列",
        id: "comments.summary",
        title: "评论治理上下文",
        value: "pending=2",
      },
    ]);
  });

  it("lets the LLM choose the generic task tool instead of short-circuiting intent", async () => {
    const runner = new RecordingAdminAgentChatRunner([
      {
        toolCallId: "tool-call-1",
        toolCallName: "start_admin_agent_task",
        type: "toolCallStart",
      },
      {
        delta: '{"reason":"分析今日评论","taskName":"comment_moderation_analysis"}',
        toolCallId: "tool-call-1",
        type: "toolCallArgsDelta",
      },
      {
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      },
    ]);
    const tools = [
      {
        description: "Start a registered persisted backend Agent task.",
        name: "start_admin_agent_task",
        parameters: {
          type: "object",
        },
      },
    ];
    const useCase = createUseCase(runner);

    const events = await collectAsyncIterable(useCase.stream({ message: "分析今日评论", tools }));
    const finalMessage = events.find((event) => event.type === "textMessage");

    expect(runner.lastInput).toMatchObject({
      message: "分析今日评论",
      tools: [
        expect.objectContaining({
          name: "start_admin_agent_task",
        }),
      ],
    });
    expect(finalMessage).toBeUndefined();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolCallName: "start_admin_agent_task",
          type: "toolCallStart",
        }),
        expect.objectContaining({
          delta: '{"reason":"分析今日评论","taskName":"comment_moderation_analysis"}',
          type: "toolCallArgsDelta",
        }),
        expect.objectContaining({
          type: "toolCallEnd",
        }),
      ]),
    );
  });
});

class RecordingAdminAgentChatRunner implements AdminAgentChatRunner {
  lastInput: AdminAgentChatReplyInput | null = null;
  private readonly events: AdminAgentChatRunnerEvent[];

  constructor(events: string | AdminAgentChatRunnerEvent[]) {
    this.events =
      typeof events === "string"
        ? [
            {
              delta: events,
              type: "textDelta",
            },
          ]
        : events;
  }

  async *streamReply(input: AdminAgentChatReplyInput) {
    this.lastInput = input;

    for (const event of this.events) {
      yield event;
    }
  }
}

class RecordingAdminAgentChatMessageRepository implements AdminAgentChatMessageRepository {
  readonly records: RecordAdminAgentConversationMessageInput[] = [];

  async listConversationMessages() {
    return [];
  }

  async recordMessage(input: RecordAdminAgentConversationMessageInput) {
    this.records.push(input);
  }
}

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];

  for await (const value of iterable) {
    values.push(value);
  }

  return values;
}

function createUseCase(
  runner: AdminAgentChatRunner,
  repository = new RecordingAdminAgentChatMessageRepository(),
) {
  return new SendAdminAgentChatMessageUseCase(runner, repository);
}
