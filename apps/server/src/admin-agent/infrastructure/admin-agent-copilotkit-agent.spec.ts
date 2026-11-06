import { EventType, type RunAgentInput } from "@ag-ui/core";
import { lastValueFrom, toArray } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { AdminAgentChatRunnerEvent } from "../domain/admin-agent-chat-runner";
import { AdminAgentAgUiAgent } from "./admin-agent-copilotkit-agent";

const input = (): RunAgentInput => ({
  context: [],
  messages: [{ content: "分析今天的评论", id: "user-1", role: "user" }],
  runId: "run-1",
  threadId: "thread-1",
  tools: [],
});
function setup(events: AdminAgentChatRunnerEvent[]) {
  const stream = vi.fn(async function* (_input: unknown) {
    yield* events;
  });
  const execute = vi.fn();
  const serverTools = [
    { name: "search_comments", description: "Search", parameters: { type: "object" }, execute },
  ];
  const agent = new AdminAgentAgUiAgent({
    actorUserId: "admin-1",
    chatMessageRepository: { recordMessage: vi.fn() } as never,
    sendChatMessage: { stream } as never,
    serverTools,
  });
  return { agent, stream, execute, serverTools };
}
describe("AdminAgentAgUiAgent", () => {
  it("forwards trusted server tools once and maps pi's complete tool lifecycle", async () => {
    const f = setup([
      { type: "turnStart", messageId: "pi-answer-1", reasoningMessageId: "pi-reasoning-1" },
      { type: "toolCallStart", toolCallId: "call-1", toolCallName: "search_comments" },
      { type: "toolCallArgsDelta", toolCallId: "call-1", delta: '{"period":"TODAY"}' },
      { type: "toolCallEnd", toolCallId: "call-1" },
      { type: "turnEnd" },
      {
        type: "toolResult",
        toolCallId: "call-1",
        messageId: "pi-result-1",
        content: '{"ok":true}',
      },
      { type: "turnStart", messageId: "pi-answer-2", reasoningMessageId: "pi-reasoning-2" },
      { type: "textDelta", delta: "没有需要处理的评论。" },
      { type: "turnEnd" },
    ]);
    const request = input();
    request.tools = [
      {
        name: "untrusted_browser_tool",
        description: "Do not execute",
        parameters: { type: "object" },
      },
    ];
    const events = await lastValueFrom(f.agent.run(request).pipe(toArray()));
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
    expect(f.stream).toHaveBeenCalledOnce();
    expect(f.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        conversationId: "thread-1",
        userMessageId: "user-1",
        serverTools: f.serverTools,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(f.stream.mock.calls[0]?.[0]).not.toHaveProperty("tools");
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("maps durable A2UI activities without rendering arbitrary tool output", async () => {
    const activity = {
      id: "activity-1",
      role: "activity" as const,
      activityType: "a2ui-surface",
      content: { a2ui_operations: [] },
    };
    const f = setup([{ type: "activity", activity }]);
    const events = await lastValueFrom(f.agent.run(input()).pipe(toArray()));
    expect(events.find((event) => event.type === EventType.ACTIVITY_SNAPSHOT)).toMatchObject({
      messageId: activity.id,
      content: activity.content,
      replace: true,
    });
  });
  it("uses pi's stable reasoning IDs and closes a turn before the next one", async () => {
    const f = setup([
      { type: "turnStart", messageId: "answer-1", reasoningMessageId: "reasoning-1" },
      { type: "reasoningDelta", delta: "先确认数据范围。" },
      { type: "textDelta", delta: "已完成。" },
      { type: "turnEnd" },
    ]);
    const events = await lastValueFrom(f.agent.run(input()).pipe(toArray()));
    expect(events.find((event) => event.type === EventType.REASONING_MESSAGE_START)).toMatchObject({
      messageId: "reasoning-1",
    });
    expect(events.find((event) => event.type === EventType.REASONING_MESSAGE_END)).toMatchObject({
      messageId: "reasoning-1",
    });
    expect(events.find((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)).toMatchObject({
      messageId: "answer-1",
    });
  });
  it("emits exactly one terminal error event", async () => {
    const stream = vi.fn(async function* () {
      throw new Error("Model unavailable");
      yield;
    });
    const agent = new AdminAgentAgUiAgent({
      chatMessageRepository: {} as never,
      sendChatMessage: { stream } as never,
    });
    const events = await lastValueFrom(agent.run(input()).pipe(toArray()));
    expect(events.map((event) => event.type)).toEqual([EventType.RUN_STARTED, EventType.RUN_ERROR]);
  });
});
