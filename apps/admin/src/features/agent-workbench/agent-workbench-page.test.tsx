// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskListResponse,
} from "@adrian-zephyr-notes/contracts";
import { adminAgentTaskCatalog } from "@adrian-zephyr-notes/contracts";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentWorkbenchPage } from "./agent-workbench-page";

const adminApiMocks = vi.hoisted(() => ({
  listConversationMessages: vi.fn(),
  listAgentTasks: vi.fn(),
  loadHome: vi.fn(),
  streamChatMessage: vi.fn(),
}));
const copilotKitMocks = vi.hoisted(() => ({
  agentMessages: [] as Array<{ role: string; toolCalls?: Array<{ id: string }> }>,
  useAgentContext: vi.fn(),
  useHumanInTheLoop: vi.fn(),
  useRenderToolCall: vi.fn<() => (params: { toolCall: { id: string } }) => ReactNode>(
    () => () => null,
  ),
}));

vi.mock("./agent-api-client", () => ({
  useAgentWorkbenchClient: () => adminApiMocks,
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
  },
  useAgent: () => ({
    agent: {
      messages: copilotKitMocks.agentMessages,
    },
  }),
  useAgentContext: copilotKitMocks.useAgentContext,
  useHumanInTheLoop: copilotKitMocks.useHumanInTheLoop,
  useRenderToolCall: copilotKitMocks.useRenderToolCall,
}));

const scrollIntoViewMock = vi.fn();

describe("AgentWorkbenchPage command surface", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    copilotKitMocks.agentMessages = [];
    copilotKitMocks.useRenderToolCall.mockReturnValue(() => null);
    window.localStorage.clear();
    adminApiMocks.listConversationMessages.mockResolvedValue({ data: [] });
    adminApiMocks.listAgentTasks.mockResolvedValue(createTaskListResponse());
    scrollIntoViewMock.mockClear();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    cleanup();
  });

  it("starts as a single assistant dialog without default dashboard panels", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());

    renderAgentWorkbench();

    expect(await screen.findByRole("region", { name: "Agent 对话框" })).not.toBeNull();
    expect(screen.getByText("下午好")).not.toBeNull();
    expect(screen.getByRole("img", { name: "AZ Notes Agent 助手" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "打开工作台菜单" })).not.toBeNull();
    expect(screen.getByText("进入文章工作台")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "语音输入" })).toBeNull();

    await waitFor(() => {
      expect(adminApiMocks.loadHome).toHaveBeenCalledTimes(1);
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        rootOnly: true,
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "WAITING_FOR_APPROVAL",
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "RUNNING",
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "FAILED",
        taskName: "ALL",
      });
    });

    expect(screen.queryByText("今日评论")).toBeNull();
    expect(screen.queryByText("最近治理动作")).toBeNull();
    expect(screen.queryByLabelText("Agent 工作台视图")).toBeNull();
    expect(screen.queryByRole("button", { name: "查看审计日志" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/LangGraph|checkpoint|threadId|workflowName/);
  });

  it("restores persisted conversation messages for the stable workbench conversation", async () => {
    window.localStorage.setItem("az-notes-agent-conversation-id", "conversation-1");
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.listConversationMessages.mockResolvedValue({
      data: [
        {
          content: "上次的问题",
          createdAt: "2026-07-04T05:00:00.000Z",
          id: "message-1",
          role: "user",
        },
        {
          content: "上次的回答",
          createdAt: "2026-07-04T05:00:01.000Z",
          id: "message-2",
          role: "assistant",
        },
      ],
    });

    renderAgentWorkbench();

    expect(await screen.findByText("上次的问题")).not.toBeNull();
    expect(screen.getByText("上次的回答")).not.toBeNull();
    expect(adminApiMocks.listConversationMessages).toHaveBeenCalledWith("conversation-1");
  });

  it("registers each workbench context entry separately for CopilotKit runs", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.listAgentTasks.mockResolvedValueOnce(
      createTaskListResponse({
        data: [
          createTask({
            id: "run-retryable",
            status: "FAILED",
            summary: "上一次评论治理失败。",
          }),
        ],
      }),
    );
    adminApiMocks.listAgentTasks.mockResolvedValueOnce(createTaskListResponse());

    renderAgentWorkbench();

    await waitFor(() => {
      expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("comments.summary\n评论治理上下文"),
          value: expect.stringContaining('"todayCommentCount":0'),
        }),
      );
    });
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("workspace.capabilities\n工作台能力注册表"),
      }),
    );
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("workspace.businessTaskContext\nAgent 业务处理上下文"),
        value: expect.stringContaining("run-retryable"),
      }),
    );
    expect(screen.queryByText("上一次评论治理失败。")).toBeNull();
  });

  it("prioritizes actionable business tasks in the private LLM context", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.listAgentTasks
      .mockResolvedValueOnce(createTaskListResponse())
      .mockResolvedValueOnce(
        createTaskListResponse({
          data: [
            createTask({
              id: "waiting-approval-run",
              status: "WAITING_FOR_APPROVAL",
              summary: "评论治理等待管理员选择。",
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createTaskListResponse({
          data: [
            createTask({
              id: "running-site-run",
              status: "RUNNING",
              summary: "站点巡检正在处理。",
              taskName: "site_config_review",
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createTaskListResponse({
          data: [
            createTask({
              id: "failed-audit-run",
              status: "FAILED",
              summary: "审计复盘需要重新处理。",
              taskName: "audit_review",
            }),
          ],
        }),
      );

    renderAgentWorkbench();

    await waitFor(() => {
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "WAITING_FOR_APPROVAL",
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "RUNNING",
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 8,
        status: "FAILED",
        taskName: "ALL",
      });
    });
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("workspace.businessTaskContext\nAgent 业务处理上下文"),
        value: expect.stringContaining("waiting-approval-run"),
      }),
    );
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.stringContaining("running-site-run"),
      }),
    );
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.stringContaining("failed-audit-run"),
      }),
    );
    expect(screen.queryByText("评论治理等待管理员选择。")).toBeNull();
    expect(screen.queryByText("站点巡检正在处理。")).toBeNull();
    expect(screen.queryByText("审计复盘需要重新处理。")).toBeNull();
  });

  it("loads child business actions for recent parent tasks", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.listAgentTasks
      .mockResolvedValueOnce(
        createTaskListResponse({
          data: [
            createTask({
              id: "parent-run",
              status: "COMPLETED",
              summary: "跨域协作已完成。",
              taskName: "multi_task_orchestration",
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(createTaskListResponse())
      .mockResolvedValueOnce(createTaskListResponse())
      .mockResolvedValueOnce(createTaskListResponse())
      .mockResolvedValueOnce(
        createTaskListResponse({
          data: [
            createTask({
              id: "child-comments",
              parentTaskId: "parent-run",
              relation: "child",
              status: "WAITING_FOR_APPROVAL",
              summary: "评论治理等待确认。",
              taskName: "comment_moderation_analysis",
            }),
          ],
        }),
      );

    renderAgentWorkbench();

    await waitFor(() => {
      expect(adminApiMocks.listAgentTasks).toHaveBeenNthCalledWith(1, {
        page: 1,
        pageSize: 8,
        rootOnly: true,
        taskName: "ALL",
      });
      expect(adminApiMocks.listAgentTasks).toHaveBeenNthCalledWith(5, {
        page: 1,
        pageSize: 8,
        parentTaskId: "parent-run",
        relation: "child",
        taskName: "ALL",
      });
    });
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("workspace.businessTaskContext\nAgent 业务处理上下文"),
        value: expect.stringContaining("childBusinessTasks"),
      }),
    );
    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.stringContaining("child-comments"),
      }),
    );
    expect(screen.queryByText("评论治理等待确认。")).toBeNull();
  });

  it("does not request persisted workflow events for the assistant dialog", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.listAgentTasks.mockResolvedValueOnce(
      createTaskListResponse({
        data: [
          createTask({
            id: "run-events",
            status: "WAITING_FOR_APPROVAL",
            summary: "等待管理员确认。",
          }),
        ],
      }),
    );
    adminApiMocks.listAgentTasks.mockResolvedValueOnce(createTaskListResponse());
    renderAgentWorkbench();

    await screen.findByText("下午好");

    expect(copilotKitMocks.useAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("workspace.businessTaskContext\nAgent 业务处理上下文"),
        value: expect.stringContaining("等待管理员确认"),
      }),
    );
    expect(screen.queryByRole("region", { name: "Agent 事件流" })).toBeNull();
    expect(screen.queryByText("读取")).toBeNull();
    expect(screen.queryByText("待确认")).toBeNull();
    expect(screen.queryByText("等待管理员确认风险建议。")).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|human_approval/,
    );
  });

  it("streams unknown prompts through the LLM chat endpoint", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "这个操作需要你先确认范围，",
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:01.000Z",
        delta: "我不会直接删除内容。",
        id: "chat-delta-2",
        messageId: "message-1",
        type: "textDelta",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:02.000Z",
        id: "chat-message",
        message: {
          content: "这个操作需要你先确认范围，我不会直接删除内容。",
          role: "assistant",
        },
        type: "textMessage",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "帮我自动删除所有内容" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(
      await screen.findByText("这个操作需要你先确认范围，我不会直接删除内容。"),
    ).not.toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "帮我自动删除所有内容",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("starts a new assistant bubble after a human-in-the-loop tool resumes", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "请选择下一步。",
        id: "before-question-delta",
        messageId: "message-1",
        type: "textDelta",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:01.000Z",
        id: "question-tool-start",
        toolCallId: "tool-call-1",
        toolCallName: "ask_user_question",
        type: "toolCallStart",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:02.000Z",
        id: "question-tool-end",
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:03.000Z",
        delta: "好的，我会重新扫描并生成屏蔽建议。",
        id: "after-question-delta",
        messageId: "message-1",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "帮我处理评论" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    const beforeQuestionMessage = await screen.findByText("请选择下一步。");
    const afterQuestionMessage = await screen.findByText("好的，我会重新扫描并生成屏蔽建议。");

    expect(beforeQuestionMessage.closest(".rounded-xl")).not.toBe(
      afterQuestionMessage.closest(".rounded-xl"),
    );
  });

  it("renders human-in-the-loop cards at their timeline position before resumed text", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    copilotKitMocks.agentMessages = [
      {
        role: "assistant",
        toolCalls: [{ id: "tool-call-1" }],
      },
    ];
    copilotKitMocks.useRenderToolCall.mockReturnValue(
      ({ toolCall }: { toolCall: { id: string } }) => (
        <div data-testid={`tool-card-${toolCall.id}`}>已选择 忽略这条建议</div>
      ),
    );
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "请选择是否忽略这条建议。",
        id: "before-question-delta",
        messageId: "message-1",
        type: "textDelta",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:01.000Z",
        id: "question-tool-start",
        toolCallId: "tool-call-1",
        toolCallName: "ask_user_question",
        type: "toolCallStart",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:02.000Z",
        id: "question-tool-end",
        toolCallId: "tool-call-1",
        type: "toolCallEnd",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:03.000Z",
        delta: "好的，我会发起忽略确认。",
        id: "after-question-delta",
        messageId: "message-1",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "帮我处理评论" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    const beforeQuestionMessage = await screen.findByText("请选择是否忽略这条建议。");
    const completedQuestionCard = await screen.findByTestId("tool-card-tool-call-1");
    const afterQuestionMessage = await screen.findByText("好的，我会发起忽略确认。");

    expect(
      beforeQuestionMessage.compareDocumentPosition(completedQuestionCard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      completedQuestionCard.compareDocumentPosition(afterQuestionMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders streamed assistant markdown inside the dialog", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta:
          '# 处理建议\n\n- **先审核** 评论证据\n- 再决定是否屏蔽\n\n[打开评论治理](/comments)\n\n```ts\nconst action = "review";\n```',
        id: "markdown-chat-delta",
        messageId: "message-1",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "给我 markdown 格式的处理建议" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    const heading = await screen.findByText("处理建议");
    expect(heading.closest("h1")).not.toBeNull();
    expect(screen.getByText("先审核")).not.toBeNull();
    expect(screen.getByRole("link", { name: "打开评论治理" }).getAttribute("href")).toBe(
      "/comments",
    );
    expect(screen.getByText('const action = "review";')).not.toBeNull();
  });

  it("keeps greeting prompts out of the comment-analysis surface", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "你好，我在。",
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta",
      });
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:01.000Z",
        id: "chat-message",
        message: {
          content: "你好，我在。",
          role: "assistant",
        },
        type: "textMessage",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("你好，我在。")).not.toBeNull();
    expect(screen.queryByText("Agent 分析已完成")).toBeNull();
    expect(screen.queryByLabelText("Agent 思考过程")).toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Hello",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("sends recent dialog turns into the streamed LLM request", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (input, handlers) => {
      const responseText =
        input.message === "进入文章工作台"
          ? "文章工作台需求我会先通过对话澄清。"
          : "下一步我会继续接入文章卡片。";

      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: responseText,
        id: "chat-delta-1",
        messageId: "message-1",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "进入文章工作台" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await screen.findByText("文章工作台需求我会先通过对话澄清。");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "接下来怎么做？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("下一步我会继续接入文章卡片。")).not.toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "接下来怎么做？",
        recentMessages: [
          expect.objectContaining({ role: "user", text: "进入文章工作台" }),
          expect.objectContaining({
            role: "assistant",
            text: "文章工作台需求我会先通过对话澄清。",
          }),
        ],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("routes audit prompts through the streamed LLM endpoint", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "我会根据审计日志说明最近操作。",
        id: "audit-chat-delta",
        messageId: "audit-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "查看审计日志" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("我会根据审计日志说明最近操作。")).not.toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "查看审计日志",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("routes refresh prompts through the streamed LLM endpoint", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "我会先解释当前状态，再建议你是否刷新数据。",
        id: "refresh-chat-delta",
        messageId: "refresh-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await waitFor(() => {
      expect(adminApiMocks.loadHome).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "刷新一下状态" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("我会先解释当前状态，再建议你是否刷新数据。")).not.toBeNull();
    await waitFor(() => {
      expect(adminApiMocks.loadHome).toHaveBeenCalledTimes(2);
    });
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "刷新一下状态",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("streams today comment analysis through ordinary chat", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:02.000Z",
        delta: "已按普通聊天流分析评论：需要复核 2 条高风险内容。",
        id: "comment-analysis-delta",
        messageId: "comment-analysis-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "分析今日评论" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(adminApiMocks.streamChatMessage).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText("已按普通聊天流分析评论：需要复核 2 条高风险内容。"),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Agent 输出组件")).toBeNull();
    expect(screen.queryByLabelText("Agent 执行进度")).toBeNull();
    expect(screen.queryByText("读取评论")).toBeNull();
    expect(screen.queryByText("RUNNING")).toBeNull();
    expect(screen.queryByRole("button", { name: /正在读取评论/ })).toBeNull();
    expect(screen.queryByText("评论治理 Agent")).toBeNull();
    expect(screen.queryByText("我开始分析今日评论，进度和风险卡片会继续在这里更新。")).toBeNull();
    expect(screen.queryByText("Agent 分析已启动")).toBeNull();
    expect(screen.queryByText("Agent 摘要")).toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "分析今日评论",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("removes partial comment-analysis run cards when the agent stream fails", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async () => {
      throw new Error("The operation was aborted due to timeout");
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "分析今日评论" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(
      await screen.findByText("LLM 请求超时，已停止等待。请稍后重试，或调高 LLM_TIMEOUT_MS。"),
    ).not.toBeNull();
    expect(screen.queryByText("评论治理 Agent")).toBeNull();
    expect(screen.queryByText("读取评论")).toBeNull();
    expect(screen.queryByLabelText("Agent 思考过程")).toBeNull();
  });

  it("routes site configuration prompts through the streamed LLM endpoint", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "我会用对话方式帮你梳理站点配置。",
        id: "site-chat-delta",
        messageId: "site-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "巡检站点配置" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("我会用对话方式帮你梳理站点配置。")).not.toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "巡检站点配置",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("routes future workspace domains through the streamed LLM endpoint", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "文章工作台需求我会先通过对话澄清。",
        id: "article-chat-delta",
        messageId: "article-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "进入文章工作台" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("文章工作台需求我会先通过对话澄清。")).not.toBeNull();
    expect(adminApiMocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "进入文章工作台",
        recentMessages: [],
      }),
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it("anchors newly submitted conversation turns to the bottom of the dialog", async () => {
    adminApiMocks.loadHome.mockResolvedValue(createHomeResponse());
    adminApiMocks.streamChatMessage.mockImplementation(async (_input, handlers) => {
      handlers.onEvent({
        createdAt: "2026-07-04T05:00:00.000Z",
        delta: "收到。",
        id: "anchor-chat-delta",
        messageId: "anchor-message",
        type: "textDelta",
      });
    });

    renderAgentWorkbench();

    await screen.findByText("下午好");

    fireEvent.change(screen.getByLabelText("Agent 指令"), {
      target: { value: "进入文章工作台" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: "end",
      });
    });
  });
});

function renderAgentWorkbench(overrides: Partial<ComponentProps<typeof AgentWorkbenchPage>> = {}) {
  return render(<AgentWorkbenchPage {...overrides} />);
}

function createHomeResponse(
  overrides: Partial<AdminAgentHomeResponse> = {},
): AdminAgentHomeResponse {
  return {
    assistantBrief: "今天没有待处理风险。",
    automationCandidateCount: 0,
    automationPolicy: {
      autoHideEnabled: false,
      confidenceThreshold: 0.9,
      eligibleCategories: ["SPAM"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    },
    capabilities: [
      {
        description: "分析文章评论、生成风险建议，并在管理员确认后执行治理动作。",
        id: "comments",
        requiresApprovalForWrites: true,
        status: "AVAILABLE",
        supportsChat: true,
        title: "评论治理",
      },
      {
        description: "协助选题、草稿检查、发布前巡检和摘要生成。",
        id: "articles",
        requiresApprovalForWrites: true,
        status: "PLANNED",
        supportsChat: true,
        title: "文章工作台",
      },
      {
        description: "巡检首页、导航、公告和社交链接，生成可确认的站点管理规划。",
        id: "site",
        requiresApprovalForWrites: true,
        status: "AVAILABLE",
        supportsChat: true,
        title: "站点巡检",
      },
      {
        description: "解释最近管理动作、追踪治理记录，并辅助定位风险操作。",
        id: "audit",
        requiresApprovalForWrites: false,
        status: "AVAILABLE",
        supportsChat: true,
        title: "审计日志",
      },
    ],
    executedActionCount: 0,
    findings: [],
    lastUpdatedAt: "2026-07-04T05:00:00.000Z",
    pendingFindingCount: 0,
    recentActions: [],
    tasks: [...adminAgentTaskCatalog],
    todayCommentCount: 0,
    todayHiddenCommentCount: 0,
    todayVisibleCommentCount: 0,
    ...overrides,
  };
}

function createTaskListResponse(
  overrides: Partial<AdminAgentTaskListResponse> = {},
): AdminAgentTaskListResponse {
  const data = overrides.data ?? [];

  return {
    data,
    pagination: {
      page: 1,
      pageSize: 5,
      totalItems: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      ...overrides.pagination,
    },
  };
}

function createTask(
  overrides: Partial<AdminAgentTaskSummaryResponse> = {},
): AdminAgentTaskSummaryResponse {
  return {
    createdAt: "2026-07-04T05:00:00.000Z",
    errorMessage: null,
    id: "run-1",
    latestEvent: null,
    parentTaskId: null,
    relation: null,
    status: "COMPLETED",
    summary: "评论治理 Agent 任务已完成。",
    updatedAt: "2026-07-04T05:01:00.000Z",
    taskName: "comment_moderation_analysis",
    ...overrides,
  };
}
