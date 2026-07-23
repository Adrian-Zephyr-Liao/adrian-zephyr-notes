import { Inject, Injectable } from "@nestjs/common";
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
  assistantMessageId: string;
  conversationId?: string | null;
  context?: AdminAgentChatContextEntry[];
  message: string;
  persistUserMessage?: boolean;
  recentMessages?: AdminAgentChatMessage[];
  tools?: AdminAgentChatTool[];
  userMessageId: string;
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

  async *stream(input: SendAdminAgentChatMessageInput): AsyncIterable<AdminAgentChatRunnerEvent> {
    const message = input.message.trim();

    if (!message) {
      throw new AdminAgentChatValidationError("Message is required.");
    }

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
        conversationId,
        message: {
          content: normalizedUserMessage,
          id: normalizeMessageId(input.userMessageId, "user"),
          role: "user",
        },
      });
    }

    for await (const event of this.adminAgentChatRunner.streamReply({
      context,
      message: normalizedUserMessage,
      recentMessages: normalizeRecentMessages(input.recentMessages ?? []),
      ...(tools.length ? { tools } : {}),
    })) {
      if (event.type === "reasoningDelta") {
        if (event.delta) {
          yield event;
        }

        continue;
      }

      if (event.type !== "textDelta") {
        hasToolCall = true;
        bufferToolCallEvent(bufferedToolCalls, event);
        yield event;
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

      yield { delta, type: "textDelta" };
    }

    const trimmedContent = content.trim();

    if (!trimmedContent && !hasToolCall) {
      throw new Error("Admin agent LLM response did not include message content.");
    }

    if (conversationId && (trimmedContent || hasToolCall)) {
      await this.chatMessageRepository.recordMessage({
        actorUserId: null,
        conversationId,
        message: {
          content: trimmedContent,
          id: normalizeMessageId(input.assistantMessageId, "assistant"),
          role: "assistant",
          ...(bufferedToolCalls.size
            ? {
                toolCalls: [...bufferedToolCalls.values()].map((toolCall) => ({
                  function: {
                    arguments: toolCall.arguments,
                    name: toolCall.name,
                  },
                  id: toolCall.id,
                  type: "function" as const,
                })),
              }
            : {}),
        },
      });
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

function normalizeMessageId(value: string, prefix: string) {
  const normalized = value.trim();

  return normalized ? normalized.slice(0, 240) : `${prefix}-${crypto.randomUUID()}`;
}

function bufferToolCallEvent(
  toolCalls: Map<string, BufferedAdminAgentToolCall>,
  event: Exclude<AdminAgentChatRunnerEvent, { type: "reasoningDelta" | "textDelta" }>,
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
  const normalizedMessages = messages.flatMap((message): AdminAgentChatMessage[] => {
    const content = message.content.trim();

    if (!content && (message.role !== "assistant" || !message.toolCalls?.length)) {
      return [];
    }

    return [normalizeRecentMessageContent(message, content)];
  });

  return takeRecentCompleteMessageGroups(normalizedMessages, maxRecentMessages);
}

function takeRecentCompleteMessageGroups(messages: AdminAgentChatMessage[], maxMessages: number) {
  const groups: AdminAgentChatMessage[][] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    if (message.role === "tool") {
      continue;
    }

    if (message.role !== "assistant" || !message.toolCalls?.length) {
      groups.push([message]);
      continue;
    }

    const expectedToolCallIds = new Set(message.toolCalls.map((toolCall) => toolCall.id));
    const toolResults: AdminAgentChatMessage[] = [];
    let cursor = index + 1;

    while (cursor < messages.length && messages[cursor]?.role === "tool") {
      const toolResult = messages[cursor];

      if (toolResult?.role === "tool" && expectedToolCallIds.has(toolResult.toolCallId)) {
        expectedToolCallIds.delete(toolResult.toolCallId);
        toolResults.push(toolResult);
      }

      cursor += 1;
    }

    if (expectedToolCallIds.size === 0) {
      groups.push([message, ...toolResults]);
    }

    index = cursor - 1;
  }

  const selectedGroups: AdminAgentChatMessage[][] = [];
  let selectedMessageCount = 0;

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];

    if (!group) {
      continue;
    }

    if (selectedMessageCount > 0 && selectedMessageCount + group.length > maxMessages) {
      break;
    }

    selectedGroups.unshift(group);
    selectedMessageCount += group.length;
  }

  return selectedGroups.flat();
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

export {
  AdminAgentChatValidationError,
  SendAdminAgentChatMessageUseCase,
  normalizeContextEntries,
  normalizeRecentMessages,
};
export type { SendAdminAgentChatMessageInput };
