import type { AdminAgentInteractionEvent } from "@adrian-zephyr-notes/contracts";
import { EventType } from "@ag-ui/client";

function toTextContentFromAdminAgentInteractionEvent(event: AdminAgentInteractionEvent) {
  if (event.type === "textDelta") {
    return event.delta;
  }

  if (event.type === "textMessage") {
    return event.message.content;
  }

  return null;
}

function toToolCallEventFromAdminAgentInteractionEvent(event: AdminAgentInteractionEvent) {
  if (event.type === "toolCallStart") {
    return {
      toolCallId: event.toolCallId,
      toolCallName: event.toolCallName,
      type: EventType.TOOL_CALL_START,
    };
  }

  if (event.type === "toolCallArgsDelta") {
    return {
      delta: event.delta,
      toolCallId: event.toolCallId,
      type: EventType.TOOL_CALL_ARGS,
    };
  }

  if (event.type === "toolCallEnd") {
    return {
      toolCallId: event.toolCallId,
      type: EventType.TOOL_CALL_END,
    };
  }

  return null;
}

export {
  toTextContentFromAdminAgentInteractionEvent,
  toToolCallEventFromAdminAgentInteractionEvent,
};
