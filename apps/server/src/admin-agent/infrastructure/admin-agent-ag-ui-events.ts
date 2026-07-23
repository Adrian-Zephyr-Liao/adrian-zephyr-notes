import {
  ActivitySnapshotEventSchema,
  EventType,
  ReasoningEndEventSchema,
  ReasoningMessageContentEventSchema,
  ReasoningMessageEndEventSchema,
  ReasoningMessageStartEventSchema,
  ReasoningStartEventSchema,
  RunErrorEventSchema,
  RunFinishedEventSchema,
  RunStartedEventSchema,
  TextMessageContentEventSchema,
  TextMessageEndEventSchema,
  TextMessageStartEventSchema,
  ToolCallArgsEventSchema,
  ToolCallEndEventSchema,
  ToolCallResultEventSchema,
  ToolCallStartEventSchema,
  type BaseEvent,
  type RunAgentInput,
} from "@ag-ui/core";

type AdminAgentAgUiEventFactory = {
  activitySnapshot: (input: {
    activityType: string;
    content: Record<string, unknown>;
    messageId: string;
  }) => BaseEvent;
  reasoningEnd: (messageId: string) => BaseEvent;
  reasoningMessageContent: (messageId: string, delta: string) => BaseEvent;
  reasoningMessageEnd: (messageId: string) => BaseEvent;
  reasoningMessageStart: (messageId: string) => BaseEvent;
  reasoningStart: (messageId: string) => BaseEvent;
  runError: (message: string) => BaseEvent;
  runFinished: (runId: string, threadId: string) => BaseEvent;
  runStarted: (input: RunAgentInput) => BaseEvent;
  textMessageContent: (messageId: string, delta: string) => BaseEvent;
  textMessageEnd: (messageId: string) => BaseEvent;
  textMessageStart: (messageId: string) => BaseEvent;
  toolCallArgs: (toolCallId: string, delta: string) => BaseEvent;
  toolCallEnd: (toolCallId: string) => BaseEvent;
  toolCallResult: (messageId: string, toolCallId: string, content: string) => BaseEvent;
  toolCallStart: (toolCallId: string, toolCallName: string, parentMessageId: string) => BaseEvent;
};

const adminAgentAgUiEvents: AdminAgentAgUiEventFactory = {
  activitySnapshot(input) {
    return ActivitySnapshotEventSchema.parse({
      activityType: input.activityType,
      content: input.content,
      messageId: input.messageId,
      replace: true,
      type: EventType.ACTIVITY_SNAPSHOT,
    });
  },
  reasoningEnd(messageId: string) {
    return ReasoningEndEventSchema.parse({
      messageId,
      type: EventType.REASONING_END,
    });
  },
  reasoningMessageContent(messageId: string, delta: string) {
    return ReasoningMessageContentEventSchema.parse({
      delta,
      messageId,
      type: EventType.REASONING_MESSAGE_CONTENT,
    });
  },
  reasoningMessageEnd(messageId: string) {
    return ReasoningMessageEndEventSchema.parse({
      messageId,
      type: EventType.REASONING_MESSAGE_END,
    });
  },
  reasoningMessageStart(messageId: string) {
    return ReasoningMessageStartEventSchema.parse({
      messageId,
      role: "reasoning",
      type: EventType.REASONING_MESSAGE_START,
    });
  },
  reasoningStart(messageId: string) {
    return ReasoningStartEventSchema.parse({
      messageId,
      type: EventType.REASONING_START,
    });
  },
  runError(message: string) {
    return RunErrorEventSchema.parse({
      message,
      type: EventType.RUN_ERROR,
    });
  },
  runFinished(runId: string, threadId: string) {
    return RunFinishedEventSchema.parse({
      runId,
      threadId,
      type: EventType.RUN_FINISHED,
    });
  },
  runStarted(input: RunAgentInput) {
    return RunStartedEventSchema.parse({
      input,
      runId: input.runId,
      threadId: input.threadId,
      type: EventType.RUN_STARTED,
    });
  },
  textMessageContent(messageId: string, delta: string) {
    return TextMessageContentEventSchema.parse({
      delta,
      messageId,
      type: EventType.TEXT_MESSAGE_CONTENT,
    });
  },
  textMessageEnd(messageId: string) {
    return TextMessageEndEventSchema.parse({
      messageId,
      type: EventType.TEXT_MESSAGE_END,
    });
  },
  textMessageStart(messageId: string) {
    return TextMessageStartEventSchema.parse({
      messageId,
      role: "assistant",
      type: EventType.TEXT_MESSAGE_START,
    });
  },
  toolCallArgs(toolCallId: string, delta: string) {
    return ToolCallArgsEventSchema.parse({
      delta,
      toolCallId,
      type: EventType.TOOL_CALL_ARGS,
    });
  },
  toolCallEnd(toolCallId: string) {
    return ToolCallEndEventSchema.parse({
      toolCallId,
      type: EventType.TOOL_CALL_END,
    });
  },
  toolCallResult(messageId: string, toolCallId: string, content: string) {
    return ToolCallResultEventSchema.parse({
      content,
      messageId,
      role: "tool",
      toolCallId,
      type: EventType.TOOL_CALL_RESULT,
    });
  },
  toolCallStart(toolCallId: string, toolCallName: string, parentMessageId: string) {
    return ToolCallStartEventSchema.parse({
      parentMessageId,
      toolCallId,
      toolCallName,
      type: EventType.TOOL_CALL_START,
    });
  },
};

export { adminAgentAgUiEvents };
