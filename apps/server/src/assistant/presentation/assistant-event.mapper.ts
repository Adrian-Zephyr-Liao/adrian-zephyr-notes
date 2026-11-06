import { EventType, type BaseEvent } from "@ag-ui/core";
import type { AssistantEvent } from "../application/assistant-runner.port";

export async function* mapAssistantEvents(
  events: AsyncIterable<AssistantEvent>,
): AsyncGenerator<BaseEvent> {
  for await (const event of events) {
    switch (event.type) {
      case "runStarted":
        yield { type: EventType.RUN_STARTED, threadId: event.threadId, runId: event.runId };
        break;
      case "runFinished":
        yield { type: EventType.RUN_FINISHED, threadId: event.threadId, runId: event.runId };
        break;
      case "runError":
        yield { type: EventType.RUN_ERROR, code: event.code, message: event.message };
        break;
      case "textStart":
        yield { type: EventType.TEXT_MESSAGE_START, messageId: event.messageId, role: "assistant" };
        break;
      case "textDelta":
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: event.messageId,
          delta: event.delta,
        };
        break;
      case "textEnd":
        yield { type: EventType.TEXT_MESSAGE_END, messageId: event.messageId };
        break;
      case "toolStart":
        yield {
          type: EventType.TOOL_CALL_START,
          toolCallId: event.toolCallId,
          toolCallName: event.name,
          parentMessageId: event.parentMessageId,
        };
        yield {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: event.toolCallId,
          delta: JSON.stringify(event.args),
        };
        yield { type: EventType.TOOL_CALL_END, toolCallId: event.toolCallId };
        break;
      case "toolResult":
        yield {
          type: EventType.TOOL_CALL_RESULT,
          messageId: event.messageId,
          toolCallId: event.toolCallId,
          role: "tool",
          content: event.content,
        };
        break;
    }
  }
}
