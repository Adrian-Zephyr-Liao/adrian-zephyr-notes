import { EventType, type RunAgentInput } from "@ag-ui/core";
import { lastValueFrom, toArray } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { AdminAgentChatRunnerEvent } from "../domain/admin-agent-chat-runner";
import { AdminAgentAgUiAgent } from "./admin-agent-copilotkit-agent";

describe("AdminAgentAgUiAgent", () => {
  it("executes a server tool and emits the standard AG-UI tool lifecycle", async () => {
    const modelTurns: AdminAgentChatRunnerEvent[][] = [
      [
        {
          toolCallId: "call-1",
          toolCallName: "search_comments",
          type: "toolCallStart",
        },
        {
          delta: '{"period":"TODAY"}',
          toolCallId: "call-1",
          type: "toolCallArgsDelta",
        },
        {
          toolCallId: "call-1",
          type: "toolCallEnd",
        },
      ],
      [
        {
          delta: "今日没有需要分析的评论。",
          type: "textDelta",
        },
      ],
    ];
    const stream = vi.fn((..._args: unknown[]) => toAsyncIterable(modelTurns.shift() ?? []));
    const execute = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        ok: true,
        result: {
          comments: [],
          matchedCount: 0,
          truncated: false,
        },
      }),
    });
    const recordMessage = vi.fn();
    const agent = new AdminAgentAgUiAgent({
      actorUserId: "admin-1",
      chatMessageRepository: { recordMessage } as never,
      sendChatMessage: { stream } as never,
      serverTools: [
        {
          description: "Search comments.",
          execute,
          name: "search_comments",
          parameters: {
            properties: {
              period: {
                enum: ["TODAY", "RECENT"],
                type: "string",
              },
            },
            type: "object",
          },
        },
      ],
    });
    const events = await lastValueFrom(agent.run(createRunInput()).pipe(toArray()));

    expect(events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.TOOL_CALL_RESULT,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
    expect(execute).toHaveBeenCalledWith(
      { period: "TODAY" },
      {
        conversationId: "thread-1",
        runId: "run-1",
        toolCallId: "call-1",
      },
    );
    expect(events.find((event) => event.type === EventType.TOOL_CALL_RESULT)).toMatchObject({
      content: expect.stringContaining('"matchedCount":0'),
      role: "tool",
      toolCallId: "call-1",
    });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(recordMessage).toHaveBeenCalledWith({
      conversationId: "thread-1",
      message: {
        content: expect.stringContaining('"matchedCount":0'),
        id: "admin-agent-tool-result-run-1-call-1",
        role: "tool",
        toolCallId: "call-1",
      },
    });
    expect(stream.mock.calls[1]?.[0]).toMatchObject({
      persistUserMessage: false,
      recentMessages: [
        {
          content: "分析今天的评论",
          role: "user",
        },
        {
          content: "",
          role: "assistant",
          toolCalls: [
            {
              arguments: '{"period":"TODAY"}',
              id: "call-1",
              name: "search_comments",
            },
          ],
        },
        {
          content: expect.stringContaining('"matchedCount":0'),
          role: "tool",
          toolCallId: "call-1",
        },
      ],
    });
  });

  it("returns a structured tool error result and lets the model recover", async () => {
    const modelTurns: AdminAgentChatRunnerEvent[][] = [
      [
        {
          toolCallId: "call-1",
          toolCallName: "analyze_comments",
          type: "toolCallStart",
        },
        {
          delta: "not-json",
          toolCallId: "call-1",
          type: "toolCallArgsDelta",
        },
        {
          toolCallId: "call-1",
          type: "toolCallEnd",
        },
      ],
      [{ delta: "分析参数无效，请重新选择评论。", type: "textDelta" }],
    ];
    const stream = vi.fn((..._args: unknown[]) => toAsyncIterable(modelTurns.shift() ?? []));
    const execute = vi.fn();
    const agent = new AdminAgentAgUiAgent({
      chatMessageRepository: { recordMessage: vi.fn() } as never,
      sendChatMessage: { stream } as never,
      serverTools: [
        {
          description: "Analyze comments.",
          execute,
          name: "analyze_comments",
          parameters: { type: "object" },
        },
      ],
    });
    const events = await lastValueFrom(agent.run(createRunInput()).pipe(toArray()));
    const toolResult = events.find((event) => event.type === EventType.TOOL_CALL_RESULT);

    expect(execute).not.toHaveBeenCalled();
    expect(toolResult).toMatchObject({
      content: expect.stringContaining("TOOL_EXECUTION_FAILED"),
      toolCallId: "call-1",
    });
    expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
  });

  it("emits and persists a durable activity snapshot returned by a server tool", async () => {
    const modelTurns: AdminAgentChatRunnerEvent[][] = [
      [
        {
          toolCallId: "call-activity",
          toolCallName: "analyze_comments",
          type: "toolCallStart",
        },
        {
          delta: '{"commentIds":["comment-1"]}',
          toolCallId: "call-activity",
          type: "toolCallArgsDelta",
        },
        {
          toolCallId: "call-activity",
          type: "toolCallEnd",
        },
      ],
      [{ delta: "分析完成。", type: "textDelta" }],
    ];
    const stream = vi.fn((..._args: unknown[]) => toAsyncIterable(modelTurns.shift() ?? []));
    const activity = {
      activityType: "a2ui-surface",
      content: { a2ui_operations: [] },
      id: "comment-analysis-activity-analysis-1",
      role: "activity" as const,
    };
    const recordMessage = vi.fn();
    const agent = new AdminAgentAgUiAgent({
      chatMessageRepository: { recordMessage } as never,
      sendChatMessage: { stream } as never,
      serverTools: [
        {
          description: "Analyze comments.",
          execute: vi.fn().mockResolvedValue({
            activity,
            content: JSON.stringify({ ok: true, result: { analysisId: "analysis-1" } }),
          }),
          name: "analyze_comments",
          parameters: { type: "object" },
        },
      ],
    });

    const events = await lastValueFrom(agent.run(createRunInput()).pipe(toArray()));

    expect(events.find((event) => event.type === EventType.ACTIVITY_SNAPSHOT)).toMatchObject({
      activityType: "a2ui-surface",
      content: activity.content,
      messageId: activity.id,
      replace: true,
    });
    expect(recordMessage).toHaveBeenCalledWith({
      conversationId: "thread-1",
      message: activity,
    });
  });
});

function createRunInput(): RunAgentInput {
  return {
    context: [],
    messages: [
      {
        content: "分析今天的评论",
        id: "user-1",
        role: "user",
      },
    ],
    runId: "run-1",
    threadId: "thread-1",
    tools: [],
  };
}

function toAsyncIterable(
  events: AdminAgentChatRunnerEvent[],
): AsyncIterable<AdminAgentChatRunnerEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
  };
}
