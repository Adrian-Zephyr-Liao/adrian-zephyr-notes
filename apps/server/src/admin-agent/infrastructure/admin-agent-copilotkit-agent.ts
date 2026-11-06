import { AbstractAgent } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput, Context, Message } from "@ag-ui/core";
import { Observable } from "rxjs";
import type {
  AdminAgentChatContextEntry,
  AdminAgentServerTool,
} from "../domain/admin-agent-chat-runner";
import type { AdminAgentChatMessageRepository } from "../domain/admin-agent-chat-message.repository";
import { SendAdminAgentChatMessageUseCase } from "../application/send-admin-agent-chat-message.use-case";
import { adminAgentAgUiEvents as events } from "./admin-agent-ag-ui-events";

type AdminAgentAgUiAgentDeps = {
  actorUserId?: string | null;
  chatMessageRepository: AdminAgentChatMessageRepository;
  sendChatMessage: SendAdminAgentChatMessageUseCase;
  serverTools?: AdminAgentServerTool[];
};

/** Transport only: pi-durable owns the conversation and executes registered server tools. */
class AdminAgentAgUiAgent extends AbstractAgent {
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
      const detach = new AbortController();
      const emit = (event: BaseEvent) => {
        if (!observer.closed) observer.next(event);
      };
      emit(events.runStarted(input));
      void this.stream(input, detach.signal, emit)
        .then(() => {
          emit(events.runFinished(input.runId, input.threadId));
          observer.complete();
        })
        .catch((error: unknown) => {
          if (!observer.closed) {
            emit(events.runError(error instanceof Error ? error.message : "Unknown agent error"));
            observer.complete();
          }
        });
      return () => detach.abort();
    });
  }
  private async stream(
    input: RunAgentInput,
    signal: AbortSignal,
    emit: (event: BaseEvent) => void,
  ) {
    const latestUser = [...input.messages].reverse().find((message) => message.role === "user");
    const message = latestUser ? toMessageText(latestUser) : "";
    if (!message) throw new Error("CopilotKit run input did not include a user message.");
    let messageId = `admin-agent-message-${input.runId}-1`;
    let reasoningMessageId = `admin-agent-reasoning-message-${input.runId}-1`;
    let textStarted = false;
    let reasoningStarted = false;
    const finishReasoning = () => {
      if (!reasoningStarted) return;
      emit(events.reasoningMessageEnd(reasoningMessageId));
      emit(events.reasoningEnd(reasoningMessageId));
      reasoningStarted = false;
    };
    const finishTurn = () => {
      finishReasoning();
      if (textStarted) emit(events.textMessageEnd(messageId));
      textStarted = false;
    };
    try {
      for await (const event of this.deps.sendChatMessage.stream({
        actorUserId: this.deps.actorUserId,
        assistantMessageId: messageId,
        reasoningMessageId,
        conversationId: toConversationId(input),
        context: toRecentChatContext(input.context),
        message,
        recentMessages: [],
        serverTools: this.deps.serverTools ?? [],
        userMessageId: latestUser!.id,
        runId: input.runId,
        signal,
      })) {
        if (event.type === "turnStart") {
          finishTurn();
          messageId = event.messageId;
          reasoningMessageId = event.reasoningMessageId;
        } else if (event.type === "turnEnd") {
          finishTurn();
        } else if (event.type === "reasoningDelta" && event.delta) {
          if (!reasoningStarted) {
            emit(events.reasoningStart(reasoningMessageId));
            emit(events.reasoningMessageStart(reasoningMessageId));
            reasoningStarted = true;
          }
          emit(events.reasoningMessageContent(reasoningMessageId, event.delta));
        } else if (event.type === "textDelta" && event.delta) {
          finishReasoning();
          if (!textStarted) {
            emit(events.textMessageStart(messageId));
            textStarted = true;
          }
          emit(events.textMessageContent(messageId, event.delta));
        } else if (event.type === "toolCallStart") {
          finishReasoning();
          emit(events.toolCallStart(event.toolCallId, event.toolCallName, messageId));
        } else if (event.type === "toolCallArgsDelta") {
          emit(events.toolCallArgs(event.toolCallId, event.delta));
        } else if (event.type === "toolCallEnd") {
          emit(events.toolCallEnd(event.toolCallId));
        } else if (event.type === "toolResult") {
          emit(events.toolCallResult(event.messageId, event.toolCallId, event.content));
        } else if (event.type === "activity") {
          emit(
            events.activitySnapshot({
              activityType: event.activity.activityType,
              content: event.activity.content,
              messageId: event.activity.id,
            }),
          );
        }
      }
    } finally {
      finishTurn();
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

export { AdminAgentAgUiAgent };
export type { AdminAgentAgUiAgentDeps };
