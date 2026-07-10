import {
  AbstractAgent,
  EventType,
  type BaseEvent,
  type Context,
  type Message,
  type RunAgentInput,
  type Tool,
} from "@ag-ui/client";
import { Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import type {
  AdminAgentChatContextEntry,
  AdminAgentChatMessage,
  AdminAgentChatTool,
} from "../domain/admin-agent-chat-runner";
import { SendAdminAgentChatMessageUseCase } from "../application/send-admin-agent-chat-message.use-case";
import {
  toTextContentFromAdminAgentInteractionEvent,
  toToolCallEventFromAdminAgentInteractionEvent,
} from "./admin-agent-copilotkit-events.mapper";

type AdminAgentCopilotKitAgentDeps = {
  sendChatMessage: SendAdminAgentChatMessageUseCase;
};

class AdminAgentCopilotKitAgent extends AbstractAgent {
  private readonly logger = new Logger(AdminAgentCopilotKitAgent.name);

  constructor(private readonly deps: AdminAgentCopilotKitAgentDeps) {
    super({
      agentId: "admin-agent",
      description: "AZ Notes admin agent for content operations and review workflows.",
    });
  }

  clone() {
    return new AdminAgentCopilotKitAgent(this.deps);
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      let aborted = false;

      void this.runInternal(input, {
        emit: (event) => {
          if (!aborted) {
            observer.next(event);
          }
        },
        isAborted: () => aborted,
      })
        .then(() => {
          if (!aborted) {
            observer.complete();
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unknown agent error";
          const stack = error instanceof Error ? error.stack : undefined;

          this.logger.error(message, stack);

          if (!aborted) {
            observer.next({
              message,
              type: EventType.RUN_ERROR,
            } as BaseEvent);
            observer.error(error);
          }
        });

      return () => {
        aborted = true;
      };
    });
  }

  private async runInternal(
    input: RunAgentInput,
    stream: {
      emit: (event: BaseEvent) => void;
      isAborted: () => boolean;
    },
  ) {
    stream.emit({
      input,
      runId: input.runId,
      threadId: input.threadId,
      type: EventType.RUN_STARTED,
    } as BaseEvent);

    await this.streamChatReply(input, stream);

    stream.emit({
      runId: input.runId,
      threadId: input.threadId,
      type: EventType.RUN_FINISHED,
    } as BaseEvent);
  }

  private async streamChatReply(
    input: RunAgentInput,
    stream: {
      emit: (event: BaseEvent) => void;
      isAborted: () => boolean;
    },
  ) {
    const hasToolResultAfterLatestUserValue = hasToolResultAfterLatestUser(input.messages);
    const message = hasToolResultAfterLatestUserValue
      ? "请根据刚刚的工具执行结果，继续以简短中文回复管理员。"
      : getLatestUserMessageText(input.messages);

    if (!message) {
      throw new Error("CopilotKit run input did not include a user message.");
    }

    const messageId = `admin-agent-message-${input.runId}`;
    let started = false;
    const tools = toChatTools(input.tools);

    for await (const event of this.deps.sendChatMessage.stream({
      conversationId: toConversationId(input),
      context: toRecentChatContext(input.context),
      message,
      persistUserMessage: !hasToolResultAfterLatestUserValue,
      recentMessages: toPriorChatMessages(input.messages),
      ...(tools.length ? { tools } : {}),
    })) {
      if (stream.isAborted()) {
        return;
      }

      const toolEvent = toToolCallEventFromAdminAgentInteractionEvent(event);

      if (toolEvent) {
        stream.emit(toolEvent as BaseEvent);
        continue;
      }

      const text = toTextContentFromAdminAgentInteractionEvent(event);

      if (!text || event.type === "textMessage") {
        continue;
      }

      if (!started) {
        stream.emit({
          messageId,
          role: "assistant",
          type: EventType.TEXT_MESSAGE_START,
        } as BaseEvent);
        started = true;
      }

      stream.emit({
        delta: text,
        messageId,
        type: EventType.TEXT_MESSAGE_CONTENT,
      } as BaseEvent);
    }

    if (started) {
      stream.emit({
        messageId,
        type: EventType.TEXT_MESSAGE_END,
      } as BaseEvent);
    }
  }
}

function toConversationId(input: RunAgentInput) {
  const forwardedProps = input.forwardedProps;
  const forwardedConversationId =
    forwardedProps &&
    typeof forwardedProps === "object" &&
    !Array.isArray(forwardedProps) &&
    "conversationId" in forwardedProps &&
    typeof forwardedProps.conversationId === "string"
      ? forwardedProps.conversationId.trim()
      : "";

  return forwardedConversationId || input.threadId || input.runId;
}

function toRecentChatContext(context: Context[]): AdminAgentChatContextEntry[] {
  return context.flatMap((entry, index) => {
    const [idLine, titleLine, ...descriptionLines] = entry.description.split("\n");
    const id = idLine?.trim() || `copilot-context-${index + 1}`;
    const title = titleLine?.trim() || id;
    const description = descriptionLines.join("\n").trim() || title;
    const value = entry.value.trim();

    if (!value) {
      return [];
    }

    return [
      {
        description,
        id,
        title,
        value,
      },
    ];
  });
}

function getLatestUserMessageText(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "user") {
      return toMessageText(message);
    }
  }

  return "";
}

function toPriorChatMessages(messages: Message[]): AdminAgentChatMessage[] {
  const latestUserMessageIndex = findLatestUserMessageIndex(messages);
  const hasToolResultAfterLatestUserValue = hasToolResultAfterLatestUser(messages);
  const priorMessages =
    latestUserMessageIndex === -1 || hasToolResultAfterLatestUserValue
      ? messages
      : messages.slice(0, latestUserMessageIndex);

  const chatMessages: AdminAgentChatMessage[] = [];

  for (const message of priorMessages) {
    if (message.role === "tool") {
      const content = toMessageText(message).trim();
      const toolCallId =
        "toolCallId" in message && typeof message.toolCallId === "string" ? message.toolCallId : "";

      if (!content || !toolCallId) {
        continue;
      }

      chatMessages.push({
        content,
        role: "tool",
        toolCallId,
      });
      continue;
    }

    if (message.role !== "assistant" && message.role !== "user") {
      continue;
    }

    const content = toMessageText(message).trim();

    if (!content && (message.role !== "assistant" || !message.toolCalls?.length)) {
      continue;
    }

    if (message.role === "assistant") {
      chatMessages.push({
        content,
        role: "assistant",
        ...(message.toolCalls?.length
          ? {
              toolCalls: message.toolCalls.map((toolCall) => ({
                arguments: toolCall.function.arguments,
                id: toolCall.id,
                name: toolCall.function.name,
              })),
            }
          : {}),
      });
      continue;
    }

    chatMessages.push({ content, role: "user" });
  }

  return chatMessages;
}

function findLatestUserMessageIndex(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return -1;
}

function hasToolResultAfterLatestUser(messages: Message[]) {
  const latestUserMessageIndex = findLatestUserMessageIndex(messages);

  return (
    latestUserMessageIndex >= 0 &&
    messages.slice(latestUserMessageIndex + 1).some((message) => message.role === "tool")
  );
}

function toMessageText(message: Message) {
  const content = message.content;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((part) => {
      if (typeof part === "string") {
        return [part];
      }

      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return [part.text];
      }

      return [];
    })
    .join("\n");
}

function toChatTools(tools: Tool[] = []): AdminAgentChatTool[] {
  return tools.flatMap((tool): AdminAgentChatTool[] => {
    const name = tool.name.trim();

    if (!name) {
      return [];
    }

    return [
      {
        description: tool.description.trim(),
        name,
        parameters: toToolParameters(tool.parameters),
      },
    ];
  });
}

function toToolParameters(parameters: Tool["parameters"]): Record<string, unknown> {
  if (parameters && typeof parameters === "object" && !Array.isArray(parameters)) {
    return parameters as Record<string, unknown>;
  }

  return {
    additionalProperties: false,
    properties: {},
    type: "object",
  };
}

export { AdminAgentCopilotKitAgent };
export type { AdminAgentCopilotKitAgentDeps };
