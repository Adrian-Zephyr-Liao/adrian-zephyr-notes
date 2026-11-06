// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CopilotChatReasoningMessageProps } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentReasoningDurationProvider, AgentReasoningMessage } from "./agent-reasoning-message";

vi.mock("@copilotkit/react-core/v2", () => {
  function Content({ children, className }: { children?: ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
  }

  return {
    CopilotChatReasoningMessage: Object.assign(() => null, {
      Content,
      Header: () => null,
      Toggle: () => null,
    }),
  };
});

const reasoningMessage = {
  content: "先确认数据范围，再分析关键指标。",
  id: "reasoning-1",
  role: "reasoning",
} as CopilotChatReasoningMessageProps["message"];

describe("AgentReasoningMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T10:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps reasoning in a three-line scroll viewport after it completes", () => {
    const { rerender } = renderReasoningMessage(true);

    const activeTrigger = screen.getByRole("button", {
      name: "正在执行（已用时0秒），展开执行明细",
    });
    const activeViewport = screen
      .getByText("先确认数据范围，再分析关键指标。")
      .closest("[data-reasoning-content-viewport]");

    expect(activeTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(activeViewport?.className).toContain("max-h-28");
    expect(activeViewport?.className).toContain("overflow-y-auto");

    act(() => {
      vi.advanceTimersByTime(65_000);
    });

    expect(
      screen.getByRole("button", {
        name: "正在执行（已用时1分5秒），展开执行明细",
      }),
    ).not.toBeNull();

    rerender(
      <AgentReasoningDurationProvider durations={{}}>
        <AgentReasoningMessage
          isRunning={false}
          message={reasoningMessage}
          messages={[reasoningMessage]}
        />
      </AgentReasoningDurationProvider>,
    );

    const completedTrigger = screen.getByRole("button", {
      name: "执行完成（用时1分5秒），展开执行明细",
    });
    expect(completedTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(activeViewport?.className).toContain("max-h-28");
    expect(activeViewport?.className).toContain("overflow-y-auto");

    fireEvent.click(completedTrigger);

    expect(
      screen
        .getByRole("button", {
          name: "执行完成（用时1分5秒），收起执行明细",
        })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(activeViewport?.className).not.toContain("max-h-28");
    expect(activeViewport?.className).not.toContain("overflow-y-auto");
    expect(screen.getByText("先确认数据范围，再分析关键指标。")).not.toBeNull();
  });

  it("restores completed reasoning from history in the compact state", () => {
    renderReasoningMessage(false, { "reasoning-1": 65_000 });

    const completedTrigger = screen.getByRole("button", {
      name: "执行完成（用时1分5秒），展开执行明细",
    });

    expect(completedTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("先确认数据范围，再分析关键指标。")).not.toBeNull();
  });

  it("stops timing when the latest turn already has a final assistant response", () => {
    const completedMessages = [
      {
        content: "分析今日评论",
        id: "user-1",
        role: "user",
      },
      reasoningMessage,
      {
        content: "今日评论分析完成，已生成 1 条待处理建议。",
        id: "assistant-final",
        role: "assistant",
      },
    ] as unknown as CopilotChatReasoningMessageProps["messages"];

    render(
      <AgentReasoningDurationProvider durations={{ "reasoning-1": 6_000 }}>
        <AgentReasoningMessage isRunning message={reasoningMessage} messages={completedMessages} />
      </AgentReasoningDurationProvider>,
    );

    const completedTrigger = screen.getByRole("button", {
      name: "执行完成（用时6秒），展开执行明细",
    });

    expect(completedTrigger.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(
      screen.getByRole("button", {
        name: "执行完成（用时6秒），展开执行明细",
      }),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: /正在执行/ })).toBeNull();
  });

  it("uses live provider messages when CopilotKit keeps reasoning props stale", () => {
    const userMessage = {
      content: "分析今日评论",
      id: "user-1",
      role: "user",
    };
    const staleMessages = [
      userMessage,
      reasoningMessage,
    ] as unknown as CopilotChatReasoningMessageProps["messages"];
    const liveMessages = [
      userMessage,
      reasoningMessage,
      {
        content: "今日评论分析完成，已生成 1 条待处理建议。",
        id: "assistant-final",
        role: "assistant",
      },
    ] as unknown as CopilotChatReasoningMessageProps["messages"];

    render(
      <AgentReasoningDurationProvider
        durations={{ "reasoning-1": 6_000 }}
        isRunning
        messages={liveMessages}
      >
        <AgentReasoningMessage isRunning message={reasoningMessage} messages={staleMessages} />
      </AgentReasoningDurationProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: "执行完成（用时6秒），展开执行明细",
      }),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: /正在执行/ })).toBeNull();
  });

  it("keeps running when the latest assistant message still carries a tool call", () => {
    const toolCallMessages = [
      {
        content: "分析今日评论",
        id: "user-1",
        role: "user",
      },
      reasoningMessage,
      {
        content: "我来筛选今日评论并进行分析。",
        id: "assistant-tool-call",
        role: "assistant",
        toolCalls: [
          {
            function: {
              arguments: '{"period":"TODAY"}',
              name: "search_comments",
            },
            id: "tool-call-1",
            type: "function",
          },
        ],
      },
    ] as unknown as CopilotChatReasoningMessageProps["messages"];

    render(
      <AgentReasoningDurationProvider durations={{}}>
        <AgentReasoningMessage isRunning message={reasoningMessage} messages={toolCallMessages} />
      </AgentReasoningDurationProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: "正在执行（已用时0秒），展开执行明细",
      }),
    ).not.toBeNull();
  });

  it("does not invent a duration when older history has no timing metadata", () => {
    renderReasoningMessage(false);

    expect(screen.getByRole("button", { name: "执行完成，展开执行明细" })).not.toBeNull();
    expect(screen.queryByText(/用时/)).toBeNull();
  });

  it("groups reasoning across tool activities into one task-level execution process", () => {
    const reasoningMessages = [
      reasoningMessage,
      {
        content: "已找到 1 条今日可见评论，准备进行风险分析。",
        id: "reasoning-2",
        role: "reasoning",
      },
      {
        content: "分析完成，已生成 1 条待处理建议。",
        id: "reasoning-3",
        role: "reasoning",
      },
    ] as CopilotChatReasoningMessageProps["message"][];
    const messages = [
      {
        content: "分析今日评论",
        id: "user-1",
        role: "user",
      },
      reasoningMessages[0],
      {
        activityType: "a2ui-surface",
        content: {},
        id: "activity-1",
        role: "activity",
      },
      reasoningMessages[1],
      {
        content: "正在调用评论分析工具",
        id: "tool-1",
        role: "tool",
      },
      reasoningMessages[2],
      {
        content: "今日评论分析完成。",
        id: "assistant-1",
        role: "assistant",
      },
    ] as unknown as CopilotChatReasoningMessageProps["messages"];

    render(
      <AgentReasoningDurationProvider
        durations={{
          "reasoning-1": 1_000,
          "reasoning-2": 2_000,
          "reasoning-3": 3_000,
        }}
      >
        {reasoningMessages.map((message) => (
          <AgentReasoningMessage
            key={message.id}
            isRunning={false}
            message={message}
            messages={messages}
          />
        ))}
      </AgentReasoningDurationProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: "执行完成（用时6秒，3个步骤），展开执行明细",
    });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(
      screen.getByRole("button", {
        name: "执行完成（用时6秒，3个步骤），收起执行明细",
      }),
    ).not.toBeNull();

    expect(screen.getByText("步骤 1")).not.toBeNull();
    expect(screen.getByText("步骤 2")).not.toBeNull();
    expect(screen.getByText("步骤 3")).not.toBeNull();
    expect(screen.getByText("先确认数据范围，再分析关键指标。")).not.toBeNull();
    expect(screen.getByText("已找到 1 条今日可见评论，准备进行风险分析。")).not.toBeNull();
    expect(screen.getByText("分析完成，已生成 1 条待处理建议。")).not.toBeNull();
  });

  it("replaces persisted English reasoning with a Chinese execution summary", () => {
    const englishReasoning = {
      content:
        "The user wants all historical comments analyzed. I need to call search_comments first.",
      id: "reasoning-english",
      role: "reasoning",
    } as CopilotChatReasoningMessageProps["message"];
    const messages = [
      {
        content: "分析历史评论",
        id: "user-1",
        role: "user",
      },
      englishReasoning,
      {
        content: "",
        id: "assistant-tool-call",
        role: "assistant",
        toolCalls: [
          {
            function: {
              arguments: '{"period":"ALL"}',
              name: "search_comments",
            },
            id: "tool-call-1",
            type: "function",
          },
        ],
      },
      {
        content: "{}",
        id: "tool-result-1",
        role: "tool",
      },
      {
        content: "评论分析已完成。",
        id: "assistant-final",
        role: "assistant",
      },
    ] as unknown as CopilotChatReasoningMessageProps["messages"];

    render(
      <AgentReasoningDurationProvider durations={{}}>
        <AgentReasoningMessage isRunning={false} message={englishReasoning} messages={messages} />
      </AgentReasoningDurationProvider>,
    );

    expect(screen.queryByText(/The user wants all historical comments/)).toBeNull();
    expect(screen.getByText("正在筛选符合条件的评论。")).not.toBeNull();
  });
});

function renderReasoningMessage(
  isRunning: boolean,
  reasoningDurations: Record<string, number> = {},
) {
  return render(
    <AgentReasoningDurationProvider durations={reasoningDurations}>
      <AgentReasoningMessage
        isRunning={isRunning}
        message={reasoningMessage}
        messages={[reasoningMessage]}
      />
    </AgentReasoningDurationProvider>,
  );
}
