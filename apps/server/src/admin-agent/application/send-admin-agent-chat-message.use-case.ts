import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminAgentAssistantMessage,
  AdminAgentInteractionEvent,
} from "@adrian-zephyr-notes/contracts";
import {
  ADMIN_AGENT_CHAT_RUNNER,
  type AdminAgentChatContextEntry,
  type AdminAgentChatMessage,
  type AdminAgentChatRunner,
  type AdminAgentChatRunnerEvent,
  type AdminAgentChatTool,
} from "../domain/admin-agent-chat-runner";
import {
  ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
  type AdminAgentChatMessageRepository,
} from "../domain/admin-agent-chat-message.repository";

type SendAdminAgentChatMessageInput = {
  actorUserId?: string | null;
  conversationId?: string | null;
  context?: AdminAgentChatContextEntry[];
  message: string;
  persistUserMessage?: boolean;
  recentMessages?: AdminAgentChatMessage[];
  tools?: AdminAgentChatTool[];
};

const maxContextEntries = 12;
const maxContextFieldLength = 6000;
const maxRecentMessages = 8;
const maxInputMessageLength = 2000;
const maxAssistantResponseLength = 12_000;

@Injectable()
class SendAdminAgentChatMessageUseCase {
  constructor(
    @Inject(ADMIN_AGENT_CHAT_RUNNER)
    private readonly adminAgentChatRunner: AdminAgentChatRunner,
    @Inject(ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: AdminAgentChatMessageRepository,
  ) {}

  async *stream(input: SendAdminAgentChatMessageInput): AsyncIterable<AdminAgentInteractionEvent> {
    const message = input.message.trim();

    if (!message) {
      throw new AdminAgentChatValidationError("Message is required.");
    }

    const messageId = `agent-chat-${Date.now()}`;
    let index = 0;
    let content = "";
    let hasToolCall = false;
    const conversationId = normalizeConversationId(input.conversationId);
    const bufferedToolCalls = new Map<string, BufferedAdminAgentToolCall>();

    const context = await this.buildChatContext(message, input.context ?? []);
    const tools = normalizeTools(input.tools ?? []);
    const normalizedUserMessage = message.slice(0, maxInputMessageLength);

    if (conversationId && input.persistUserMessage !== false) {
      await this.chatMessageRepository.recordMessage({
        actorUserId: input.actorUserId ?? null,
        content: normalizedUserMessage,
        conversationId,
        role: "USER",
      });
    }

    for await (const event of this.adminAgentChatRunner.streamReply({
      context,
      message: normalizedUserMessage,
      recentMessages: normalizeRecentMessages(input.recentMessages ?? []),
      ...(tools.length ? { tools } : {}),
    })) {
      if (event.type !== "textDelta") {
        hasToolCall = true;
        bufferToolCallEvent(bufferedToolCalls, event);
        yield toToolInteractionEvent(messageId, index, event);
        index += 1;
        continue;
      }

      if (content.length >= maxAssistantResponseLength) {
        continue;
      }

      const delta = event.delta.slice(0, maxAssistantResponseLength - content.length);

      if (!delta) {
        continue;
      }

      content += delta;

      yield {
        createdAt: new Date().toISOString(),
        delta,
        id: `${messageId}-delta-${index}`,
        messageId,
        type: "textDelta",
      };

      index += 1;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent && !hasToolCall) {
      throw new Error("Admin agent LLM response did not include message content.");
    }

    if (conversationId && (trimmedContent || hasToolCall)) {
      await this.chatMessageRepository.recordMessage({
        actorUserId: null,
        content: trimmedContent,
        conversationId,
        metadata: bufferedToolCalls.size
          ? {
              toolCalls: [...bufferedToolCalls.values()],
            }
          : null,
        role: "ASSISTANT",
      });
    }

    if (trimmedContent) {
      const assistantMessage: AdminAgentAssistantMessage = {
        content: trimmedContent,
        role: "assistant",
      };

      for (const event of toChatInteractionEvents(messageId, assistantMessage)) {
        yield event;
      }
    }
  }

  private async buildChatContext(
    message: string,
    context: AdminAgentChatContextEntry[],
  ): Promise<AdminAgentChatContextEntry[]> {
    void message;
    return normalizeContextEntries(context);
  }
}

class AdminAgentChatValidationError extends Error {}

type BufferedAdminAgentToolCall = {
  arguments: string;
  id: string;
  name: string;
};

function normalizeConversationId(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized.slice(0, 200) : null;
}

function bufferToolCallEvent(
  toolCalls: Map<string, BufferedAdminAgentToolCall>,
  event: Exclude<AdminAgentChatRunnerEvent, { type: "textDelta" }>,
) {
  if (event.type === "toolCallStart") {
    toolCalls.set(event.toolCallId, {
      arguments: "",
      id: event.toolCallId,
      name: event.toolCallName,
    });
    return;
  }

  if (event.type === "toolCallArgsDelta") {
    const existing =
      toolCalls.get(event.toolCallId) ??
      ({
        arguments: "",
        id: event.toolCallId,
        name: "",
      } satisfies BufferedAdminAgentToolCall);

    existing.arguments += event.delta;
    toolCalls.set(event.toolCallId, existing);
  }
}

function normalizeRecentMessages(messages: AdminAgentChatMessage[]) {
  return messages
    .flatMap((message): AdminAgentChatMessage[] => {
      const content = message.content.trim();

      if (!content && (message.role !== "assistant" || !message.toolCalls?.length)) {
        return [];
      }

      return [normalizeRecentMessageContent(message, content)];
    })
    .slice(-maxRecentMessages);
}

function normalizeRecentMessageContent(
  message: AdminAgentChatMessage,
  content: string,
): AdminAgentChatMessage {
  if (message.role === "tool") {
    return {
      content: content.slice(0, maxInputMessageLength),
      role: "tool",
      toolCallId: message.toolCallId.slice(0, 200),
    };
  }

  if (message.role === "assistant") {
    return {
      content: content.slice(0, maxInputMessageLength),
      role: "assistant",
      ...(message.toolCalls?.length
        ? {
            toolCalls: message.toolCalls.slice(0, 8).map((toolCall) => ({
              arguments: toolCall.arguments.slice(0, maxInputMessageLength),
              id: toolCall.id.slice(0, 200),
              name: toolCall.name.slice(0, 200),
            })),
          }
        : {}),
    };
  }

  return {
    content: content.slice(0, maxInputMessageLength),
    role: "user",
  };
}

function normalizeTools(tools: AdminAgentChatTool[]) {
  return tools.flatMap((tool): AdminAgentChatTool[] => {
    const name = tool.name.trim();

    if (!name) {
      return [];
    }

    return [
      {
        description: tool.description.trim().slice(0, 2000),
        name: name.slice(0, 200),
        parameters: tool.parameters,
      },
    ];
  });
}

function normalizeContextEntries(entries: AdminAgentChatContextEntry[]) {
  return entries
    .flatMap((entry): AdminAgentChatContextEntry[] => {
      const id = entry.id.trim();
      const title = entry.title.trim();
      const description = entry.description.trim();
      const value = entry.value.trim();

      if (!id || !title || !value) {
        return [];
      }

      return [
        {
          description: description.slice(0, maxContextFieldLength),
          id: id.slice(0, 120),
          title: title.slice(0, 120),
          value: value.slice(0, maxContextFieldLength),
        },
      ];
    })
    .slice(0, maxContextEntries);
}

function toChatInteractionEvents(
  messageId: string,
  message: AdminAgentAssistantMessage,
): AdminAgentInteractionEvent[] {
  const createdAt = new Date().toISOString();

  return [
    {
      createdAt,
      id: `${messageId}-text`,
      message,
      type: "textMessage",
    },
  ];
}

function toToolInteractionEvent(
  messageId: string,
  index: number,
  event: Exclude<AdminAgentChatRunnerEvent, { type: "textDelta" }>,
): AdminAgentInteractionEvent {
  const createdAt = new Date().toISOString();

  if (event.type === "toolCallStart") {
    return {
      createdAt,
      id: `${messageId}-tool-start-${index}`,
      toolCallId: event.toolCallId,
      toolCallName: event.toolCallName,
      type: "toolCallStart",
    };
  }

  if (event.type === "toolCallArgsDelta") {
    return {
      createdAt,
      delta: event.delta,
      id: `${messageId}-tool-args-${index}`,
      toolCallId: event.toolCallId,
      type: "toolCallArgsDelta",
    };
  }

  return {
    createdAt,
    id: `${messageId}-tool-end-${index}`,
    toolCallId: event.toolCallId,
    type: "toolCallEnd",
  };
}

export {
  AdminAgentChatValidationError,
  SendAdminAgentChatMessageUseCase,
  normalizeContextEntries,
  normalizeRecentMessages,
};
export type { SendAdminAgentChatMessageInput };
