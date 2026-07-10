import { describe, expect, it } from "vitest";
import type {
  OpenAiCompatibleChatCompletionInput,
  OpenAiCompatibleChatCompletionStreamEvent,
  OpenAiCompatibleChatCompletionClient,
} from "./openai-compatible-chat-completion.client";
import {
  OpenAiCompatibleAdminAgentChatRunner,
  buildAdminAgentChatSystemPrompt,
  buildAdminAgentContextPrompt,
} from "./openai-compatible-admin-agent-chat.runner";

describe("OpenAiCompatibleAdminAgentChatRunner", () => {
  it("streams chat replies from the OpenAI-compatible completion client", async () => {
    const client = new RecordingChatCompletionClient([
      { delta: "你好", type: "contentDelta" },
      { delta: "，我在。", type: "contentDelta" },
    ]);
    const runner = new OpenAiCompatibleAdminAgentChatRunner(
      client as unknown as OpenAiCompatibleChatCompletionClient,
    );

    await expect(
      collectAsyncIterable(
        runner.streamReply({
          context: [
            {
              description: "当前评论治理聚合状态。",
              id: "comments.summary",
              title: "评论治理上下文",
              value: '{"pendingFindingCount":2}',
            },
          ],
          message: "Hello",
          recentMessages: [
            { content: "上一轮问题", role: "user" },
            { content: "上一轮回复", role: "assistant" },
          ],
        }),
      ),
    ).resolves.toEqual([
      {
        delta: "你好",
        type: "textDelta",
      },
      {
        delta: "，我在。",
        type: "textDelta",
      },
    ]);

    expect(client.lastInput).toMatchObject({
      maxCompletionTokens: 4096,
      messages: [
        {
          role: "system",
        },
        {
          content: "上一轮问题",
          role: "user",
        },
        {
          content: "上一轮回复",
          role: "assistant",
        },
        {
          content: "Hello",
          role: "user",
        },
      ],
      temperature: 0.4,
    });
    expect(client.lastInput).not.toHaveProperty("tools");
  });

  it("passes long text deltas through without per-chunk truncation", async () => {
    const longDelta = "a".repeat(2600);
    const client = new RecordingChatCompletionClient([{ delta: longDelta, type: "contentDelta" }]);
    const runner = new OpenAiCompatibleAdminAgentChatRunner(
      client as unknown as OpenAiCompatibleChatCompletionClient,
    );

    await expect(
      collectAsyncIterable(
        runner.streamReply({
          context: [],
          message: "输出长 Markdown",
          recentMessages: [],
        }),
      ),
    ).resolves.toEqual([
      {
        delta: longDelta,
        type: "textDelta",
      },
    ]);
  });

  it("streams tool-call deltas so CopilotKit can execute frontend tools", async () => {
    const client = new RecordingChatCompletionClient([
      {
        id: "tool-call-1",
        index: 0,
        name: "ask_user_question",
        type: "toolCallDelta",
      },
      {
        argumentsDelta: '{"question":"是否确认屏蔽？","choices":[{"id":"approve","label":"确认"}]}',
        index: 0,
        type: "toolCallDelta",
      },
    ]);
    const runner = new OpenAiCompatibleAdminAgentChatRunner(
      client as unknown as OpenAiCompatibleChatCompletionClient,
    );

    await expect(
      collectAsyncIterable(
        runner.streamReply({
          context: [],
          message: "屏蔽这条评论",
          recentMessages: [],
          tools: [
            {
              description: "Ask the admin to confirm a write operation.",
              name: "ask_user_question",
              parameters: {
                properties: {},
                type: "object",
              },
            },
          ],
        }),
      ),
    ).resolves.toEqual([
      {
        toolCallId: "tool-call-1",
        toolCallName: "ask_user_question",
        type: "toolCallStart",
      },
      {
        delta: '{"question":"是否确认屏蔽？","choices":[{"id":"approve","label":"确认"}]}',
        toolCallId: "tool-call-1",
        type: "toolCallArgsDelta",
      },
      {
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      },
    ]);
    expect(client.lastInput?.tools).toEqual([
      {
        function: {
          description: "Ask the admin to confirm a write operation.",
          name: "ask_user_question",
          parameters: {
            properties: {},
            type: "object",
          },
        },
        type: "function",
      },
    ]);
  });

  it("instructs the model not to claim backend actions were executed", () => {
    expect(buildAdminAgentChatSystemPrompt()).toContain("不能声称已经执行了后台写操作");
    expect(buildAdminAgentChatSystemPrompt()).not.toContain(
      "request_comment_moderation_confirmation",
    );
    expect(buildAdminAgentChatSystemPrompt()).toContain("必须优先调用 start_admin_agent_task");
    expect(buildAdminAgentChatSystemPrompt()).toContain("必须调用 ask_user_question 工具");
    expect(buildAdminAgentChatSystemPrompt()).toContain("agent_task_resume operation");
    expect(buildAdminAgentChatSystemPrompt()).toContain("不要把 action、findingIds");
    expect(buildAdminAgentChatSystemPrompt()).toContain("不要向管理员展示或提议服务端编排");
    expect(buildAdminAgentChatSystemPrompt()).not.toContain("LangGraph");
    expect(buildAdminAgentChatSystemPrompt()).not.toContain("运行面板");
    expect(buildAdminAgentChatSystemPrompt()).toContain("普通回复必须作为聊天内容流式输出");
    expect(buildAdminAgentChatSystemPrompt()).toContain("必须保留 Markdown 语法输出");
  });

  it("includes registered workbench context in the system prompt", () => {
    expect(
      buildAdminAgentContextPrompt({
        context: [
          {
            description: "当前评论治理聚合状态。",
            id: "comments.summary",
            title: "评论治理上下文",
            value: '{"pendingFindingCount":2}',
          },
        ],
        message: "分析一下",
        recentMessages: [],
      }),
    ).toContain("[comments.summary] 评论治理上下文");
  });
});

class RecordingChatCompletionClient {
  lastInput: OpenAiCompatibleChatCompletionInput | null = null;

  constructor(private readonly events: OpenAiCompatibleChatCompletionStreamEvent[]) {}

  async *streamEvents(input: OpenAiCompatibleChatCompletionInput) {
    this.lastInput = input;

    for (const event of this.events) {
      yield event;
    }
  }
}

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];

  for await (const value of iterable) {
    values.push(value);
  }

  return values;
}
