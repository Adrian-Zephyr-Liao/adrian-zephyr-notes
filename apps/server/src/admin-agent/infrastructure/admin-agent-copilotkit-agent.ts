import {
  AbstractAgent,
  type Context,
  type Message,
  type RunAgentInput,
  type Tool,
} from "@ag-ui/client";
import type { BaseEvent } from "@ag-ui/core";
import { Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import type {
  AdminAgentChatContextEntry,
  AdminAgentChatMessage,
  AdminAgentChatRunnerEvent,
  AdminAgentChatTool,
  AdminAgentChatToolCall,
  AdminAgentServerTool,
  AdminAgentServerToolExecutionContext,
  AdminAgentServerToolResult,
} from "../domain/admin-agent-chat-runner";
import type { AdminAgentChatMessageRepository } from "../domain/admin-agent-chat-message.repository";
import { SendAdminAgentChatMessageUseCase } from "../application/send-admin-agent-chat-message.use-case";
import { adminAgentAgUiEvents } from "./admin-agent-ag-ui-events";

type AdminAgentAgUiAgentDeps = {
  actorUserId?: string | null;
  chatMessageRepository: AdminAgentChatMessageRepository;
  sendChatMessage: SendAdminAgentChatMessageUseCase;
  serverTools?: AdminAgentServerTool[];
};

const maxServerToolTurns = 6;

class AdminAgentAgUiAgent extends AbstractAgent {
  private readonly logger = new Logger(AdminAgentAgUiAgent.name);

  constructor(private readonly deps: AdminAgentAgUiAgentDeps) {
    super({
      agentId: "admin-agent",
      description: "AZ Notes admin agent for content operations and review workflows.",
    });
  }

  clone() {
    return new AdminAgentAgUiAgent(this.deps);
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
            observer.next(adminAgentAgUiEvents.runError(message));
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
    stream.emit(adminAgentAgUiEvents.runStarted(input));

    await this.streamChatReply(input, stream);

    stream.emit(adminAgentAgUiEvents.runFinished(input.runId, input.threadId));
  }

  private async streamChatReply(
    input: RunAgentInput,
    stream: {
      emit: (event: BaseEvent) => void;
      isAborted: () => boolean;
    },
  ) {
    const hasToolResultAfterLatestUserValue = hasToolResultAfterLatestUser(input.messages);
    const latestUserMessage = getLatestUserMessage(input.messages);
    const message = hasToolResultAfterLatestUserValue
      ? "请根据刚刚的工具执行结果，继续以简短中文回复管理员。"
      : latestUserMessage
        ? toMessageText(latestUserMessage)
        : "";

    if (!message) {
      throw new Error("CopilotKit run input did not include a user message.");
    }

    const serverTools = this.deps.serverTools ?? [];
    const serverToolsByName = new Map(serverTools.map((tool) => [tool.name, tool]));
    const tools = mergeChatTools(toChatTools(input.tools), serverTools);
    const recentMessages = toPriorChatMessages(input.messages);
    const conversationId = toConversationId(input);
    const userMessageId = latestUserMessage?.id ?? `admin-agent-user-${input.runId}`;
    let nextMessage = message;
    let persistUserMessage = !hasToolResultAfterLatestUserValue;

    for (let turn = 1; turn <= maxServerToolTurns; turn += 1) {
      const result = await this.streamModelTurn({
        input,
        message: nextMessage,
        persistUserMessage,
        recentMessages,
        stream,
        tools,
        turn,
        userMessageId,
      });

      if (stream.isAborted() || result.toolCalls.length === 0) {
        return;
      }

      const serverToolCalls = result.toolCalls.filter((toolCall) =>
        serverToolsByName.has(toolCall.name),
      );

      if (serverToolCalls.length === 0) {
        return;
      }

      if (serverToolCalls.length !== result.toolCalls.length) {
        throw new Error("A model turn cannot mix server and browser tool calls.");
      }

      if (turn === 1 && !hasToolResultAfterLatestUserValue) {
        recentMessages.push({ content: message, role: "user" });
      }

      recentMessages.push({
        content: result.text,
        role: "assistant",
        toolCalls: result.toolCalls,
      });

      for (const toolCall of serverToolCalls) {
        const tool = serverToolsByName.get(toolCall.name);

        if (!tool) {
          continue;
        }

        const toolResultMessageId = `admin-agent-tool-result-${input.runId}-${toolCall.id}`;
        const result = await executeServerTool(tool, toolCall.arguments, {
          conversationId,
          runId: input.runId,
          toolCallId: toolCall.id,
        });

        await this.deps.chatMessageRepository.recordMessage({
          conversationId,
          message: {
            content: result.content,
            id: toolResultMessageId,
            role: "tool",
            toolCallId: toolCall.id,
          },
        });
        stream.emit(
          adminAgentAgUiEvents.toolCallResult(toolResultMessageId, toolCall.id, result.content),
        );
        recentMessages.push({ content: result.content, role: "tool", toolCallId: toolCall.id });

        if (result.activity) {
          await this.deps.chatMessageRepository.recordMessage({
            conversationId,
            message: result.activity,
          });
          stream.emit(
            adminAgentAgUiEvents.activitySnapshot({
              activityType: result.activity.activityType,
              content: result.activity.content,
              messageId: result.activity.id,
            }),
          );
        }
      }

      nextMessage = "请根据刚刚的工具执行结果继续完成管理员请求，不要重复结构化结果。";
      persistUserMessage = false;
    }

    throw new Error(`Admin agent exceeded ${maxServerToolTurns} server tool turns.`);
  }

  private async streamModelTurn(input: {
    input: RunAgentInput;
    message: string;
    persistUserMessage: boolean;
    recentMessages: AdminAgentChatMessage[];
    stream: {
      emit: (event: BaseEvent) => void;
      isAborted: () => boolean;
    };
    tools: AdminAgentChatTool[];
    turn: number;
    userMessageId: string;
  }) {
    const textMessageId = `admin-agent-message-${input.input.runId}-${input.turn}`;
    const toolCalls = new Map<string, AdminAgentChatToolCall>();
    let activeReasoning: { messageId: string; reasoningId: string } | null = null;
    let text = "";
    let textStarted = false;

    const finishReasoning = () => {
      if (!activeReasoning) {
        return;
      }

      input.stream.emit(adminAgentAgUiEvents.reasoningMessageEnd(activeReasoning.messageId));
      input.stream.emit(adminAgentAgUiEvents.reasoningEnd(activeReasoning.reasoningId));
      activeReasoning = null;
    };

    try {
      for await (const event of this.deps.sendChatMessage.stream({
        actorUserId: this.deps.actorUserId,
        assistantMessageId: textMessageId,
        conversationId: toConversationId(input.input),
        context: toRecentChatContext(input.input.context),
        message: input.message,
        persistUserMessage: input.persistUserMessage,
        recentMessages: input.recentMessages,
        ...(input.tools.length ? { tools: input.tools } : {}),
        userMessageId: input.userMessageId,
      })) {
        if (input.stream.isAborted()) {
          return { text, toolCalls: [] };
        }

        if (event.type === "reasoningDelta") {
          if (!event.delta) {
            continue;
          }

          if (!activeReasoning) {
            activeReasoning = {
              messageId: `admin-agent-reasoning-message-${input.input.runId}-${input.turn}`,
              reasoningId: `admin-agent-reasoning-${input.input.runId}-${input.turn}`,
            };
            input.stream.emit(adminAgentAgUiEvents.reasoningStart(activeReasoning.reasoningId));
            input.stream.emit(
              adminAgentAgUiEvents.reasoningMessageStart(activeReasoning.messageId),
            );
          }

          input.stream.emit(
            adminAgentAgUiEvents.reasoningMessageContent(activeReasoning.messageId, event.delta),
          );
          continue;
        }

        if (event.type === "toolCallStart") {
          finishReasoning();
          toolCalls.set(event.toolCallId, {
            arguments: "",
            id: event.toolCallId,
            name: event.toolCallName,
          });
          input.stream.emit(toAgUiToolCallEvent(event, textMessageId)!);
          continue;
        }

        if (event.type === "toolCallArgsDelta") {
          const toolCall = toolCalls.get(event.toolCallId);

          if (toolCall) {
            toolCall.arguments += event.delta;
          }

          finishReasoning();
          input.stream.emit(toAgUiToolCallEvent(event, textMessageId)!);
          continue;
        }

        if (event.type === "toolCallEnd") {
          finishReasoning();
          input.stream.emit(toAgUiToolCallEvent(event, textMessageId)!);
          continue;
        }

        if (event.type !== "textDelta" || !event.delta) {
          continue;
        }

        finishReasoning();
        text += event.delta;

        if (!textStarted) {
          input.stream.emit(adminAgentAgUiEvents.textMessageStart(textMessageId));
          textStarted = true;
        }

        input.stream.emit(adminAgentAgUiEvents.textMessageContent(textMessageId, event.delta));
      }
    } finally {
      finishReasoning();

      if (textStarted) {
        input.stream.emit(adminAgentAgUiEvents.textMessageEnd(textMessageId));
      }
    }

    return { text, toolCalls: [...toolCalls.values()] };
  }
}

async function executeServerTool(
  tool: AdminAgentServerTool,
  argumentsJson: string,
  context: AdminAgentServerToolExecutionContext,
): Promise<AdminAgentServerToolResult> {
  try {
    const argumentsValue = JSON.parse(argumentsJson || "{}") as unknown;

    if (!isPlainRecord(argumentsValue)) {
      throw new Error("Tool arguments must be a JSON object.");
    }

    return await tool.execute(argumentsValue, context);
  } catch (error) {
    return {
      content: JSON.stringify({
        error: {
          code: "TOOL_EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Unknown tool execution error",
        },
        ok: false,
      }),
    };
  }
}

function mergeChatTools(
  browserTools: AdminAgentChatTool[],
  serverTools: AdminAgentServerTool[],
): AdminAgentChatTool[] {
  const toolsByName = new Map<string, AdminAgentChatTool>();

  for (const tool of [...browserTools, ...serverTools]) {
    toolsByName.set(tool.name, {
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters,
    });
  }

  return [...toolsByName.values()];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toAgUiToolCallEvent(event: AdminAgentChatRunnerEvent, parentMessageId: string) {
  if (event.type === "toolCallStart") {
    return adminAgentAgUiEvents.toolCallStart(
      event.toolCallId,
      event.toolCallName,
      parentMessageId,
    );
  }

  if (event.type === "toolCallArgsDelta") {
    return adminAgentAgUiEvents.toolCallArgs(event.toolCallId, event.delta);
  }

  if (event.type === "toolCallEnd") {
    return adminAgentAgUiEvents.toolCallEnd(event.toolCallId);
  }

  return null;
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

function getLatestUserMessage(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "user") {
      return message;
    }
  }

  return null;
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

export { AdminAgentAgUiAgent };
export type { AdminAgentAgUiAgentDeps };
