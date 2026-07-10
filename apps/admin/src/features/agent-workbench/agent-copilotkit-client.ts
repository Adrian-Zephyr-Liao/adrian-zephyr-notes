import type {
  AbstractAgent,
  AgentSubscriber,
  Message,
  RunErrorEvent,
  TextMessageContentEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
} from "@ag-ui/client";
import type { CopilotKitContextValue } from "@copilotkit/react-core/v2";
import type { AdminAgentInteractionEvent } from "@adrian-zephyr-notes/contracts";
import type { AgentConversationMessage } from "./agent-workbench-types";

const maxRecentMessageCount = 8;

type CopilotKitAgentRunInput = {
  conversationId: string;
  message: string;
  recentMessages: AgentConversationMessage[];
};

type CopilotKitAgentRunHandlers = {
  onError?: (error: Error) => void;
  onEvent: (event: AdminAgentInteractionEvent) => void;
};

async function streamCopilotKitAdminAgentRun(
  copilotkit: CopilotKitContextValue["copilotkit"],
  agent: AbstractAgent,
  input: CopilotKitAgentRunInput,
  handlers: CopilotKitAgentRunHandlers,
) {
  const seenInteractionEventIds = new Set<string>();
  let runError: Error | null = null;
  const subscription = agent.subscribe(
    createAdminAgentSubscriber({
      onError(error) {
        runError = error;
        handlers.onError?.(error);
      },
      onEvent(event) {
        const eventStreamKey = getInteractionEventStreamKey(event);

        if (seenInteractionEventIds.has(eventStreamKey)) {
          return;
        }

        seenInteractionEventIds.add(eventStreamKey);
        handlers.onEvent(event);
      },
    }),
  );

  agent.setMessages(toRecentCopilotKitMessages(input));
  agent.addMessage(toCurrentCopilotKitMessage(input.message));
  agent.setState({});

  try {
    await copilotkit.runAgent({
      agent,
      forwardedProps: {
        conversationId: input.conversationId,
      },
      runId: createRunId(),
    });

    if (runError) {
      throw runError;
    }
  } finally {
    subscription.unsubscribe();
  }
}

function createAdminAgentSubscriber(handlers: CopilotKitAgentRunHandlers): AgentSubscriber {
  let textDeltaSequence = 0;
  let toolCallArgsDeltaSequence = 0;

  return {
    onRunErrorEvent({ event }) {
      handlers.onError?.(new Error(toRunErrorMessage(event)));
    },
    onTextMessageContentEvent({ event }) {
      textDeltaSequence += 1;
      handlers.onEvent(toTextDeltaInteractionEvent(event, textDeltaSequence));
    },
    onToolCallArgsEvent({ event }) {
      toolCallArgsDeltaSequence += 1;
      handlers.onEvent(toToolCallArgsDeltaInteractionEvent(event, toolCallArgsDeltaSequence));
    },
    onToolCallEndEvent({ event }) {
      handlers.onEvent(toToolCallEndInteractionEvent(event));
    },
    onToolCallStartEvent({ event }) {
      handlers.onEvent(toToolCallStartInteractionEvent(event));
    },
  };
}

function toTextDeltaInteractionEvent(
  event: TextMessageContentEvent,
  sequence: number,
): AdminAgentInteractionEvent {
  const createdAt = toIsoDate(event.timestamp);

  return {
    createdAt,
    delta: event.delta,
    id: `ag-ui-text-delta-${event.messageId}-${createdAt}-${sequence}`,
    messageId: event.messageId,
    type: "textDelta",
  };
}

function toToolCallStartInteractionEvent(event: ToolCallStartEvent): AdminAgentInteractionEvent {
  const createdAt = toIsoDate(event.timestamp);

  return {
    createdAt,
    id: `ag-ui-tool-call-start-${event.toolCallId}-${createdAt}`,
    toolCallId: event.toolCallId,
    toolCallName: event.toolCallName,
    type: "toolCallStart",
  };
}

function toToolCallArgsDeltaInteractionEvent(
  event: ToolCallArgsEvent,
  sequence: number,
): AdminAgentInteractionEvent {
  const createdAt = toIsoDate(event.timestamp);

  return {
    createdAt,
    delta: event.delta,
    id: `ag-ui-tool-call-args-${event.toolCallId}-${createdAt}-${sequence}`,
    toolCallId: event.toolCallId,
    type: "toolCallArgsDelta",
  };
}

function toToolCallEndInteractionEvent(event: ToolCallEndEvent): AdminAgentInteractionEvent {
  const createdAt = toIsoDate(event.timestamp);

  return {
    createdAt,
    id: `ag-ui-tool-call-end-${event.toolCallId}-${createdAt}`,
    toolCallId: event.toolCallId,
    type: "toolCallEnd",
  };
}

function toRunErrorMessage(event: RunErrorEvent) {
  return event.message || "CopilotKit agent run failed.";
}

function toRecentCopilotKitMessages(input: CopilotKitAgentRunInput): Message[] {
  return input.recentMessages.slice(-maxRecentMessageCount).map(toCopilotKitMessage);
}

function toCurrentCopilotKitMessage(message: string): Message {
  return {
    content: message,
    id: createMessageId("user"),
    role: "user",
  } satisfies Message;
}

function toCopilotKitMessage(message: AgentConversationMessage): Message {
  return {
    content: message.text,
    id: message.id,
    role: message.role,
  } as Message;
}

function toIsoDate(timestamp?: number) {
  return new Date(timestamp ?? Date.now()).toISOString();
}

function getInteractionEventStreamKey(event: AdminAgentInteractionEvent) {
  return event.id;
}

function createRunId() {
  return `admin-agent-run-${crypto.randomUUID()}`;
}

function createMessageId(role: "assistant" | "user") {
  return `${role}-${crypto.randomUUID()}`;
}

export {
  createAdminAgentSubscriber,
  getInteractionEventStreamKey,
  streamCopilotKitAdminAgentRun,
  toCurrentCopilotKitMessage,
  toRecentCopilotKitMessages,
};
export type { CopilotKitAgentRunHandlers, CopilotKitAgentRunInput };
