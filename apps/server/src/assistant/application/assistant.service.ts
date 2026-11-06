import { createHash } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventType, type BaseEvent } from "@ag-ui/core";
import type {
  AssistantCapabilitiesResponse,
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
  type AssistantTurn,
  type AssistantTranscript,
} from "../domain/assistant.repository";
import {
  ASSISTANT_RUNNER,
  type AssistantRunner,
  type AssistantCanonicalMessage,
  type AssistantRuntimeEvent,
} from "./assistant-runner.port";
import { PiAssistantModelClient } from "../infrastructure/pi-assistant-model.client";
import { AssistantToolsRegistry } from "../infrastructure/assistant-tools.registry";
import {
  isAssistantToolResult,
  projectAssistantTranscript,
} from "../infrastructure/pi-assistant-projector";

type Actor = { id: string; login: string };
type ActiveTurn = { abort: AbortController; done: Promise<void>; resolve: () => void };
type RunInput = {
  actor: Actor;
  conversationId: string;
  requestId: string;
  message: string;
  signal: AbortSignal;
  authorize: () => Promise<void>;
};

export class AssistantRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class AssistantService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssistantService.name);
  private readonly active = new Map<string, ActiveTurn>();

  constructor(
    @Inject(ASSISTANT_REPOSITORY) private readonly repository: AssistantRepository,
    @Inject(ASSISTANT_RUNNER) private readonly runner: AssistantRunner,
    private readonly tools: AssistantToolsRegistry,
    private readonly model: PiAssistantModelClient,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.repository.interruptActiveTurns();
  }

  async onModuleDestroy() {
    const active = [...this.active.values()];
    for (const item of active) item.abort.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(active.map((item) => item.done)),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  get actionsEnabled() {
    return enabled(this.config.get("ASSISTANT_ACTIONS_ENABLED"));
  }
  private get enabled() {
    return enabled(this.config.get("ASSISTANT_ENABLED")) && this.model.isConfigured();
  }

  capabilities(actor: Actor): AssistantCapabilitiesResponse {
    if (!this.enabled) return { enabled: false, tools: [] };
    return {
      enabled: true,
      tools: this.definitions(actor, "", "").map(({ name, label, description, readOnly }) => ({
        name,
        label,
        description,
        readOnly,
      })),
    };
  }

  assertEnabled() {
    if (!this.enabled)
      throw new AssistantRequestError("ASSISTANT_UNAVAILABLE", 503, "助手当前未开放，请稍后重试。");
  }

  async createConversation(actor: Actor) {
    this.assertEnabled();
    return conversationResponse(await this.repository.createConversation(actor.id));
  }

  async history(
    actor: Actor,
    conversationId: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<AssistantHistoryResponse> {
    const conversation = await this.repository.getConversation(actor.id, conversationId);
    const [page, actions] = await Promise.all([
      this.repository.listTurns(actor.id, conversationId, options),
      this.repository.listCommentActions(actor.id, conversationId),
    ]);
    return {
      conversation: conversationResponse(conversation),
      turns: page.turns.map((turn) => ({
        ...turnResponse(turn),
        actions: actions.filter((action) => action.turnId === turn.id),
      })),
      nextBefore: page.nextBefore,
    };
  }

  async getTurn(actor: Actor, conversationId: string, requestId: string) {
    const turn = await this.repository.getTurn(actor.id, conversationId, requestId);
    return {
      ...turnResponse(turn),
      actions: await this.repository.listCommentActions(actor.id, conversationId, turn.id),
    };
  }

  async stop(actor: Actor, conversationId: string, requestId: string) {
    const turn = await this.repository.getTurn(actor.id, conversationId, requestId);
    const current = await this.repository.requestCancellation(actor.id, conversationId, turn.id);
    if (current.status === "CANCELLING") {
      const active = this.active.get(turn.id);
      if (active) active.abort.abort();
      else
        await this.repository.finishCancellation({
          ownerUserId: actor.id,
          conversationId,
          turnId: turn.id,
        });
    }
    return this.getTurn(actor, conversationId, requestId);
  }

  async start(input: RunInput): Promise<AsyncIterable<BaseEvent>> {
    this.assertEnabled();
    input.signal.throwIfAborted();
    const admitted = await this.repository.admitTurn({
      ownerUserId: input.actor.id,
      conversationId: input.conversationId,
      requestId: input.requestId,
      input: input.message,
      inputHash: createHash("sha256").update(input.message).digest("hex"),
    });
    if (!admitted.created) {
      if (admitted.turn.status === "RUNNING" || admitted.turn.status === "CANCELLING")
        throw new AssistantRequestError(
          "REQUEST_RUNNING",
          409,
          "这条请求仍在处理中，请查看状态或停止后再发送。",
        );
      return this.replay(admitted.turn);
    }
    const abort = new AbortController();
    const disconnect = () => abort.abort();
    input.signal.addEventListener("abort", disconnect, { once: true });
    if (input.signal.aborted) disconnect();
    let resolve!: () => void;
    const done = new Promise<void>((finish) => {
      resolve = finish;
    });
    const active = { abort, done, resolve };
    this.active.set(admitted.turn.id, active);
    return this.execute(input, admitted.turn, active, () =>
      input.signal.removeEventListener("abort", disconnect),
    );
  }

  private definitions(actor: Actor, conversationId: string, turnId: string) {
    return this.tools
      .create({ actor, conversationId, turnId })
      .filter((tool) => this.actionsEnabled || tool.readOnly);
  }

  private async *execute(
    input: RunInput,
    initial: AssistantTurn,
    active: ActiveTurn,
    detach: () => void,
  ): AsyncGenerator<BaseEvent> {
    const identity = {
      ownerUserId: input.actor.id,
      conversationId: input.conversationId,
      turnId: initial.id,
    };
    let transcript: AssistantTranscript = { version: 1, messages: [] };
    let terminal = false;
    const started = {
      type: EventType.RUN_STARTED,
      threadId: input.conversationId,
      runId: input.requestId,
    };
    try {
      yield started;
      const admittedState = await this.repository.getTurn(
        input.actor.id,
        input.conversationId,
        input.requestId,
      );
      if (admittedState.status === "CANCELLING") {
        active.abort.abort();
        const cancelled = await this.repository.finishCancellation({ ...identity, transcript });
        terminal = true;
        yield terminalEvent(cancelled);
        return;
      }
      if (admittedState.status !== "RUNNING") {
        terminal = true;
        yield terminalEvent(admittedState);
        return;
      }
      if (active.abort.signal.aborted) {
        const interrupted = await this.finishTerminal({
          ...identity,
          status: "INTERRUPTED",
          transcript,
          errorCode: "RUN_INTERRUPTED",
        });
        terminal = true;
        yield terminalEvent(interrupted);
        return;
      }
      const history = await this.repository.listTurns(input.actor.id, input.conversationId, {
        limit: 20,
      });
      if (history.nextBefore)
        throw new AssistantRequestError("CONTEXT_LIMIT", 409, "这段对话较长，请新建对话后继续。");
      const currentActions = await this.repository.listCommentActions(
        input.actor.id,
        input.conversationId,
      );
      const messages = refreshActionMessages(
        history.turns
          .filter((turn) => turn.id !== initial.id && turn.status === "COMPLETED")
          .flatMap((turn) => turn.transcript.messages) as AssistantCanonicalMessage[],
        currentActions,
      );
      for await (const event of this.runner.stream({
        turnId: initial.id,
        message: input.message,
        messages,
        tools: this.definitions(input.actor, input.conversationId, initial.id),
        signal: active.abort.signal,
        authorizeTool: async (name) => {
          active.abort.signal.throwIfAborted();
          this.assertEnabled();
          await input.authorize();
          const current = await this.repository.getTurn(
            input.actor.id,
            input.conversationId,
            input.requestId,
          );
          if (current.status !== "RUNNING") {
            active.abort.abort();
            active.abort.signal.throwIfAborted();
          }
          if (
            !this.definitions(input.actor, input.conversationId, initial.id).some(
              (tool) => tool.name === name,
            )
          )
            throw new AssistantRequestError("TOOL_UNAVAILABLE", 403, "该能力当前未开放。");
        },
      })) {
        if (event.type === "messages") {
          transcript = { version: 1, messages: event.messages };
          await this.repository.saveProgress({ ...identity, transcript });
        } else if (event.type === "finished") {
          transcript = { version: 1, messages: event.messages };
          const current = await this.finishTerminal({
            ...identity,
            transcript,
            status:
              event.status === "SUCCEEDED" && !active.abort.signal.aborted
                ? "COMPLETED"
                : active.abort.signal.aborted
                  ? "INTERRUPTED"
                  : "FAILED",
            errorCode: event.error?.code,
          });
          terminal = true;
          yield terminalEvent(current);
        } else {
          const wire = wireEvent(event, initial.id);
          for (const item of wire) yield item;
        }
      }
      if (!terminal) throw new Error("Assistant stream ended without a result.");
    } catch (error) {
      active.abort.abort();
      try {
        const current = await this.finishTerminal({
          ...identity,
          transcript,
          status: input.signal.aborted ? "INTERRUPTED" : "FAILED",
          errorCode:
            error instanceof AssistantRequestError ? error.code : "ASSISTANT_EXECUTION_FAILED",
        });
        terminal = true;
        yield terminalEvent(current);
      } catch {
        this.logger.error(
          JSON.stringify({
            kind: "assistant_persistence_failed",
            conversationId: input.conversationId,
            turnId: initial.id,
          }),
        );
        yield {
          type: EventType.RUN_ERROR,
          code: "RESULT_SAVE_FAILED",
          message: "结果暂未保存，请稍后重新查看记录。",
        };
      }
    } finally {
      if (!terminal) {
        active.abort.abort();
        try {
          await this.finishTerminal({
            ...identity,
            transcript,
            status: "INTERRUPTED",
            errorCode: "RUN_INTERRUPTED",
          });
        } catch {
          this.logger.error(
            JSON.stringify({ kind: "assistant_cleanup_failed", turnId: initial.id }),
          );
        }
      }
      detach();
      this.active.delete(initial.id);
      active.resolve();
    }
  }

  private async finishTerminal(input: Parameters<AssistantRepository["finishTurn"]>[0]) {
    const turn = await this.repository.finishTurn(input);
    return turn.status === "CANCELLING" ? this.repository.finishCancellation(input) : turn;
  }

  private async *replay(turn: AssistantTurn): AsyncGenerator<BaseEvent> {
    yield { type: EventType.RUN_STARTED, threadId: turn.conversationId, runId: turn.requestId };
    const projected = projectAssistantTranscript(
      turn.id,
      turn.transcript.messages as AssistantCanonicalMessage[],
    );
    for (const message of projected.messages.filter((item) => item.role === "assistant")) {
      yield { type: EventType.TEXT_MESSAGE_START, messageId: message.id, role: "assistant" };
      yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: message.id, delta: message.content };
      yield { type: EventType.TEXT_MESSAGE_END, messageId: message.id };
    }
    yield terminalEvent(turn);
  }
}

function conversationResponse(conversation: { id: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function turnResponse(turn: AssistantTurn): AssistantTurnResponse {
  return {
    id: turn.id,
    conversationId: turn.conversationId,
    requestId: turn.requestId,
    input: turn.input,
    status: turn.status,
    ...projectAssistantTranscript(turn.id, turn.transcript.messages as AssistantCanonicalMessage[]),
    actions: [],
    error: turn.errorCode
      ? {
          code: turn.errorCode,
          message:
            turn.status === "INTERRUPTED"
              ? "连接中断，已保存的记录仍可查看。"
              : "本次请求未完成，请新建请求重试。",
        }
      : null,
    createdAt: turn.createdAt.toISOString(),
    updatedAt: turn.updatedAt.toISOString(),
  };
}

function terminalEvent(turn: AssistantTurn): BaseEvent {
  return turn.status === "COMPLETED"
    ? { type: EventType.RUN_FINISHED, threadId: turn.conversationId, runId: turn.requestId }
    : {
        type: EventType.RUN_ERROR,
        code:
          turn.status === "CANCELLED" ? "RUN_CANCELLED" : turn.errorCode || `RUN_${turn.status}`,
        message:
          turn.status === "CANCELLED"
            ? "已停止。"
            : turn.status === "INTERRUPTED"
              ? "连接中断，请查看已保存的记录。"
              : "本次请求未完成，请新建请求重试。",
      };
}

function wireEvent(
  event: Exclude<AssistantRuntimeEvent, { type: "messages" | "finished" }>,
  turnId: string,
): BaseEvent[] {
  switch (event.type) {
    case "textStart":
      return [
        { type: EventType.TEXT_MESSAGE_START, messageId: event.messageId, role: "assistant" },
      ];
    case "textDelta":
      return [
        { type: EventType.TEXT_MESSAGE_CONTENT, messageId: event.messageId, delta: event.delta },
      ];
    case "textEnd":
      return [{ type: EventType.TEXT_MESSAGE_END, messageId: event.messageId }];
    case "toolStart":
      return [
        {
          type: EventType.TOOL_CALL_START,
          toolCallId: event.toolCallId,
          toolCallName: event.name,
          parentMessageId: event.parentMessageId,
        },
        {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: event.toolCallId,
          delta: JSON.stringify(event.args),
        },
        { type: EventType.TOOL_CALL_END, toolCallId: event.toolCallId },
      ];
    case "toolResult":
      return [
        {
          type: EventType.TOOL_CALL_RESULT,
          messageId: `${turnId}:result:${event.toolCallId}`,
          toolCallId: event.toolCallId,
          role: "tool",
          content: event.content,
        },
      ];
  }
}

function enabled(value: unknown) {
  return value === true || value === "true";
}

function refreshActionMessages(
  messages: AssistantCanonicalMessage[],
  actions: Awaited<ReturnType<AssistantRepository["listCommentActions"]>>,
) {
  return messages.map((message): AssistantCanonicalMessage => {
    if (
      message.role !== "toolResult" ||
      !isAssistantToolResult(message.details) ||
      !message.details.ok ||
      message.details.kind !== "comment_action"
    )
      return message;
    const id = message.details.data.id;
    const current = actions.find((action) => action.id === id);
    if (!current) return message;
    const details = { kind: "comment_action" as const, ok: true as const, data: current };
    return { ...message, details, content: [{ type: "text", text: JSON.stringify(details) }] };
  });
}
