import { createHash } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  type AssistantEvent,
} from "./assistant-runner.port";

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
    return enabled(this.config.get("ASSISTANT_ENABLED")) && this.runner.isConfigured();
  }

  capabilities(actor: Actor): AssistantCapabilitiesResponse {
    if (!this.enabled) return { enabled: false, tools: [] };
    return {
      enabled: true,
      tools: this.definitions(actor, "", ""),
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
        ...this.turnResponse(turn),
        actions: actions.filter((action) => action.turnId === turn.id),
      })),
      nextBefore: page.nextBefore,
    };
  }

  async getTurn(actor: Actor, conversationId: string, requestId: string) {
    const turn = await this.repository.getTurn(actor.id, conversationId, requestId);
    return {
      ...this.turnResponse(turn),
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

  async start(input: RunInput): Promise<AsyncIterable<AssistantEvent>> {
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
    return this.runner.capabilities({
      actor,
      conversationId,
      turnId,
      actionsEnabled: this.actionsEnabled,
    });
  }

  private async *execute(
    input: RunInput,
    initial: AssistantTurn,
    active: ActiveTurn,
    detach: () => void,
  ): AsyncGenerator<AssistantEvent> {
    const identity = {
      ownerUserId: input.actor.id,
      conversationId: input.conversationId,
      turnId: initial.id,
    };
    let transcript: AssistantTranscript = { version: 1, messages: [] };
    let terminal = false;
    const started = {
      type: "runStarted" as const,
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
      for await (const event of this.runner.stream({
        turnId: initial.id,
        actor: input.actor,
        conversationId: input.conversationId,
        actionsEnabled: this.actionsEnabled,
        message: input.message,
        transcripts: history.turns
          .filter((turn) => turn.id !== initial.id && turn.status === "COMPLETED")
          .map((turn) => turn.transcript),
        actions: currentActions,
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
          yield event;
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
          type: "runError",
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

  private async *replay(turn: AssistantTurn): AsyncGenerator<AssistantEvent> {
    yield { type: "runStarted", threadId: turn.conversationId, runId: turn.requestId };
    const projected = this.runner.project(turn.id, turn.transcript);
    for (const message of projected.messages.filter((item) => item.role === "assistant")) {
      yield { type: "textStart", messageId: message.id };
      yield { type: "textDelta", messageId: message.id, delta: message.content };
      yield { type: "textEnd", messageId: message.id };
    }
    yield terminalEvent(turn);
  }

  private turnResponse(turn: AssistantTurn): AssistantTurnResponse {
    return {
      id: turn.id,
      conversationId: turn.conversationId,
      requestId: turn.requestId,
      input: turn.input,
      status: turn.status,
      ...this.runner.project(turn.id, turn.transcript),
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
}

function conversationResponse(conversation: { id: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function terminalEvent(turn: AssistantTurn): AssistantEvent {
  return turn.status === "COMPLETED"
    ? { type: "runFinished", threadId: turn.conversationId, runId: turn.requestId }
    : {
        type: "runError",
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

function enabled(value: unknown) {
  return value === true || value === "true";
}
