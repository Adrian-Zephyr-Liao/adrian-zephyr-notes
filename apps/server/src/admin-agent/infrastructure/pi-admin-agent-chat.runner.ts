import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { Context } from "@earendil-works/chord/context";
import type { JsonValue } from "@earendil-works/chord";
import type { AssistantMessage, Message, ToolResultMessage } from "@earendil-works/pi-ai";
import type {
  Harness,
  ConversationDocToken,
  Conversation,
  ConversationView,
  EntryRecord,
  LiveState,
} from "@earendil-works/pi-durable";
import {
  ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
  type AdminAgentChatMessageRepository,
  type AdminAgentMessage,
} from "../domain/admin-agent-chat-message.repository";
import type {
  AdminAgentChatReplyInput,
  AdminAgentChatRunner,
  AdminAgentChatRunnerEvent,
  AdminAgentServerTool,
  AdminAgentServerToolResult,
} from "../domain/admin-agent-chat-runner";
import { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";
import {
  buildAdminAgentChatSystemPrompt,
  buildAdminAgentContextPrompt,
} from "./pi-admin-agent-chat-prompt";
import { openPiAdminAgentStorage } from "./pi-admin-agent-storage";
import { reportPiAdminAgentError } from "./pi-admin-agent-report";

type StorageHandle = Awaited<ReturnType<typeof openPiAdminAgentStorage>>;
type ChatOptions = { openStorage?: (key: string) => Promise<StorageHandle> };
const PI_ADMIN_AGENT_CHAT_OPTIONS = Symbol("PI_ADMIN_AGENT_CHAT_OPTIONS");
type ChatRequests = {
  requests: Record<string, { id: string; content: string }>;
  durations: Record<string, number>;
  pendingCancellations?: Record<string, { toolName: string }>;
};
type ActiveConversation = { root: Conversation; stopping?: Promise<void> };
const piModules = async () => {
  const [pi, chord] = await Promise.all([
    import("@earendil-works/pi-durable"),
    import("@earendil-works/chord/context"),
  ]);
  const requests = pi.defineDoc<ChatRequests>({
    kind: "az.chat-requests",
    version: 2,
    scope: "conversation",
    history: "latest",
    fork: "initial",
    initial: () => ({ requests: {}, durations: {} }),
    migrate: (value) => ({ ...value, durations: {} }) as ChatRequests,
    checkpointWhen: () => true,
  });
  return { pi, context: chord.BACKGROUND_CONTEXT, requests };
};

/** Pi owns generation and tool rounds; this class translates committed state to our UI protocol. */
@Injectable()
class PiAdminAgentChatRunner implements AdminAgentChatRunner {
  private readonly active = new Map<string, ActiveConversation>();
  private readonly pendingStops = new Set<string>();
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    private readonly modelClient: PiAdminAgentModelClient,
    private readonly config: ConfigService,
    @Inject(ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY)
    private readonly messages: AdminAgentChatMessageRepository,
    @Optional() @Inject(PI_ADMIN_AGENT_CHAT_OPTIONS) private readonly options: ChatOptions = {},
  ) {}

  async *streamReply(input: AdminAgentChatReplyInput): AsyncIterable<AdminAgentChatRunnerEvent> {
    await this.modelClient.ready();
    this.modelClient.assertConfigured();
    const inputTokenBudget = this.modelClient.contextWindow - this.modelClient.maxOutputTokens;
    if (!Number.isSafeInteger(inputTokenBudget) || inputTokenBudget < 4) {
      throw new Error(
        "Invalid model token budget: context must leave room for conversation input.",
      );
    }
    const { pi, context, requests: RequestsDoc } = await piModules();
    if (!input.actorUserId || !input.conversationId || !input.requestId) {
      throw new Error("Authenticated conversation and request IDs are required.");
    }
    await this.messages.assertConversationAccess({
      conversationId: input.conversationId,
      actorUserId: input.actorUserId,
    });
    const key = chatKey(input.actorUserId, input.conversationId);
    const release = await this.acquire(key);
    let handle: StorageHandle | undefined;
    let harness: Harness | undefined;
    let chatRoot: Conversation | undefined;
    let active: ActiveConversation | undefined;
    let detach: (() => void) | undefined;
    let ownershipLost: (() => void) | undefined;
    try {
      if (!this.pendingStops.has(key)) input.signal?.throwIfAborted();
      handle = await this.openStorage(key);
      const registry = await this.createRegistry(input, () => chatRoot!);
      harness = await pi.Harness.open(
        handle.storage,
        {
          models: this.modelClient.models,
          registry,
          identity: { attribution: null },
          onReport: reportPiAdminAgentError,
          settings: {
            toolExecution: "sequential",
            // A failed recovered request must not strand the new input queued behind it.
            afterFailedRun: "continue",
            compaction: {
              reserveTokens: this.modelClient.maxOutputTokens,
              keepRecentTokens: Math.floor(inputTokenBudget / 3),
              backgroundTokens: Math.floor(inputTokenBudget / 4),
            },
            retry: { maxRetries: 2 },
            progress: { partialIntervalMs: 30, persistWithinMs: 100 },
          },
        },
        context,
      );
      ownershipLost = () => {
        void harness?.close(context).catch(() => undefined);
      };
      handle.ownershipLost.addEventListener("abort", ownershipLost, { once: true });
      handle.ownershipLost.throwIfAborted();
      const root = await harness.root(context, {
        agent: { model: this.modelClient.modelRef, maxTurns: 12 },
      });
      chatRoot = root;
      const cancellationKey = `cancelled:${input.requestId}`;
      const { existing, cancelled: previouslyCancelled } = await root.commit(async (tx) => {
        const existing = await tx.submissionByRequest(root.id, input.requestId!);
        const doc = await tx.doc(RequestsDoc, root.id);
        const cancelled = doc.requests[cancellationKey];
        const previous = cancelled ?? (existing ? doc.requests[String(existing.id)] : undefined);
        if (previous && previous.content !== input.message)
          throw new Error("A chat request ID cannot be reused with different content.");
        const stopping = this.pendingStops.has(key);
        if (stopping && !existing && !cancelled)
          doc.requests[cancellationKey] = { id: input.requestId!, content: input.message };
        return { existing, cancelled: stopping || !!cancelled };
      }, context);
      if (previouslyCancelled) {
        await this.repairProjection(
          root,
          input.conversationId,
          input.actorUserId,
          RequestsDoc,
          context,
        );
        yield { type: "cancelled" };
        return;
      }
      await this.drainCancellations(root, input.conversationId, input.serverTools ?? []);
      active = { root };
      this.active.set(key, active);
      await root.configure(
        {
          model: this.modelClient.modelRef,
          maxTurns: 12,
          instructions: [buildAdminAgentChatSystemPrompt(), buildAdminAgentContextPrompt(input)]
            .filter(Boolean)
            .join("\n\n"),
        },
        context,
      );
      await this.bootstrapHistory(root, input);
      await this.repairProjection(
        root,
        input.conversationId,
        input.actorUserId,
        RequestsDoc,
        context,
      );

      const updates = new AsyncQueue<ConversationView>();
      const observation = await harness.observeConversation(
        root.id,
        {
          advance: (call) => {
            if (call.kind === "value") updates.push(call.value);
          },
          end: (end) =>
            updates.end(end.kind === "failed" ? new Error("Pi chat storage failed.") : undefined),
        },
        context,
        { min: 100, max: 1000 },
      );
      detach = () => observation.detach();
      const renderer = new ChatEventProjection(input.conversationId);
      renderer.skip(observation.value.entries);

      if (this.pendingStops.has(key)) {
        if (!existing)
          await root.commit(async (tx) => {
            (await tx.doc(RequestsDoc, root.id)).requests[cancellationKey] = {
              id: input.requestId!,
              content: input.message,
            };
          }, context);
        await root.abort(context);
        await this.drainCancellations(root, input.conversationId, input.serverTools ?? []);
        yield { type: "cancelled" };
        return;
      }
      const submissionId = await root.commit(async (tx) => {
        const id = await root.submit(tx, {
          type: "input",
          content: input.message,
          requestId: input.requestId,
          whenBusy: "followUp",
        });
        const requests = await tx.doc(RequestsDoc, root.id);
        const previous = requests.requests[String(id)];
        if (previous && previous.content !== input.message)
          throw new Error("A chat request ID cannot be reused with different content.");
        requests.requests[String(id)] ??= { id: input.requestId!, content: input.message };
        return id;
      }, context);
      const submission = (await harness.submission(submissionId, context))!;
      let failure: Error | undefined;
      let cancelled = false;
      const finished = submission
        .wait(context)
        .then(async (settled) => {
          await root.waitForIdle(context);
          cancelled = settled.status === "unanswered" && settled.reason === "aborted";
          if (settled.status === "unanswered" && settled.reason !== "aborted") {
            failure = new Error(
              typeof settled.detail === "string"
                ? settled.detail
                : `Pi chat ended: ${settled.reason}`,
            );
          }
        })
        .catch((error: unknown) => {
          failure = error instanceof Error ? error : new Error(String(error));
        })
        .finally(() => updates.end());
      // A duplicate completed request has no fresh publications, so replay its persisted receipt.
      const status = await submission.status(context);
      if (
        existing?.status === "done" &&
        status.status === "done" &&
        status.answer !== undefined &&
        status.entry !== undefined
      ) {
        const replay = new ChatEventProjection(input.conversationId);
        let cursor;
        do {
          const page = await root.entries(
            { order: "ascending", minEntryId: status.entry, maxEntryId: status.answer },
            100,
            cursor,
            context,
          );
          for (const entry of page.items) yield* replay.entry(entry);
          cursor = page.next;
        } while (cursor);
      }
      while (true) {
        const view = await updates.next(input.signal);
        if (!view) break;
        for (const event of renderer.view(view)) {
          if (event.type === "turnEnd") {
            const duration = renderer.completedDuration();
            if (duration)
              await root.commit(async (tx) => {
                (await tx.doc(RequestsDoc, root.id)).durations[duration.id] = duration.durationMs;
              }, context);
          }
          yield event;
        }
      }
      await finished;
      await this.repairProjection(
        root,
        input.conversationId,
        input.actorUserId,
        RequestsDoc,
        context,
      );
      if (cancelled) yield { type: "cancelled" };
      if (failure) throw failure;
    } finally {
      detach?.();
      if (ownershipLost) handle?.ownershipLost.removeEventListener("abort", ownershipLost);
      // Stops arriving after teardown starts must queue unless they can join the stop already draining.
      if (!active?.stopping) this.active.delete(key);
      // Closing suspends unfinished work; an authenticated reconnect can resume it.
      try {
        await active?.stopping?.catch(() => undefined);
        this.active.delete(key);
        await harness?.close(context);
      } finally {
        await handle?.close();
        release();
      }
    }
  }

  async abortConversation(
    actorUserId: string,
    conversationId: string,
    serverTools: AdminAgentServerTool[] = [],
  ) {
    await this.modelClient.ready();
    const { pi, context } = await piModules();
    const key = chatKey(actorUserId, conversationId);
    this.pendingStops.add(key);
    const active = this.active.get(key);
    if (active) {
      const queued = this.queues.get(key);
      if (!active.stopping) {
        const stopping = (async () => {
          await active.root.abort(context);
          await this.drainCancellations(active.root, conversationId, serverTools);
        })().finally(() => {
          if (active.stopping === stopping) active.stopping = undefined;
        });
        active.stopping = stopping;
      }
      try {
        await active.stopping;
      } finally {
        // The active stream waits only for stopping; HTTP requests already queued must also see the stop flag.
        await queued;
        this.pendingStops.delete(key);
      }
      return;
    }
    const release = await this.acquire(key);
    let handle: StorageHandle | undefined;
    let harness: Harness | undefined;
    let root: Conversation | undefined;
    try {
      handle = await this.openStorage(key);
      harness = await pi.Harness.open(
        handle.storage,
        {
          models: this.modelClient.models,
          registry: await this.createRegistry({ conversationId, serverTools }, () => root!),
          onReport: reportPiAdminAgentError,
        },
        context,
      );
      root = await harness.root(context);
      await root.abort(context);
      await this.drainCancellations(root, conversationId, serverTools);
    } finally {
      try {
        await harness?.close(context);
      } finally {
        await handle?.close();
        this.pendingStops.delete(key);
        release();
      }
    }
  }

  private async createRegistry(
    input: Pick<AdminAgentChatReplyInput, "serverTools" | "conversationId" | "runId" | "requestId">,
    readRoot: () => Conversation,
  ) {
    const { pi, requests: RequestsDoc } = await piModules();
    const serverTools = input.serverTools ?? [];
    const registry = pi.createRegistry();
    registry.install(
      pi.defineExtension({
        name: "az.admin-business",
        hooks: [
          pi.hook(pi.ToolTask, {
            afterTool: async (call, result, api, hookContext) => {
              if (
                !serverTools.some((tool) => tool.name === call.name && tool.cancel) ||
                !result.diagnostics?.some((diagnostic) => diagnostic.code === "aborted")
              )
                return;
              const root = readRoot();
              await root.commit(async (tx) => {
                const doc = await tx.doc(RequestsDoc, root.id);
                doc.pendingCancellations ??= {};
                doc.pendingCancellations[`${api.taskId}:${call.id}`] = { toolName: call.name };
              }, hookContext);
            },
          }),
        ],
        tools: serverTools.map((tool) =>
          pi.defineTool({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            // Side-effecting calls must use the business receipt before they can opt into replay.
            ...(tool.name === "search_comments" || tool.name === "analyze_comments"
              ? { replay: "safe" as const }
              : {}),
            execute: async (args, api, toolContext) => {
              if (tool.name === "hide_comments" || tool.name === "restore_comments") {
                const history = await readRoot().entries(
                  { order: "descending" },
                  100,
                  undefined,
                  toolContext,
                );
                const user = history.items.find((entry) => entry.kind === "pi.user")?.model?.[0];
                if (
                  !user ||
                  user.role !== "user" ||
                  !hasExplicitWriteIntent(tool.name, textOf(user))
                ) {
                  throw new Error(
                    "Explicit administrator confirmation is required before changing comments. Use the review card to confirm the selected comments.",
                  );
                }
              }
              const result = await tool.execute(args as Record<string, unknown>, {
                conversationId: input.conversationId!,
                runId: input.runId ?? input.requestId!,
                toolCallId: `${api.taskId}:${api.callId}`,
                signal: toolContext.abortSignal,
              });
              return {
                output: [{ type: "text", text: result.content }],
                ...(result.activity
                  ? { details: { activity: result.activity } as unknown as JsonValue }
                  : {}),
              };
            },
          }),
        ),
      }),
    );
    return registry;
  }

  private async drainCancellations(
    root: Conversation,
    conversationId: string,
    serverTools: AdminAgentServerTool[],
  ) {
    const { context, requests: RequestsDoc } = await piModules();
    const pending = await root.commit(
      async (tx) =>
        Object.entries((await tx.doc(RequestsDoc, root.id)).pendingCancellations ?? {}).map(
          ([toolCallId, receipt]) => [toolCallId, receipt.toolName] as const,
        ),
      context,
    );
    for (const [toolCallId, toolName] of pending) {
      const tool = serverTools.find((candidate) => candidate.name === toolName);
      if (!tool?.cancel)
        throw new Error(`Pending cancellation requires the registered ${toolName} tool.`);
      await tool.cancel({ conversationId, toolCallId });
      await root.commit(async (tx) => {
        const doc = await tx.doc(RequestsDoc, root.id);
        if (doc.pendingCancellations) delete doc.pendingCancellations[toolCallId];
      }, context);
    }
  }

  private openStorage(key: string) {
    return this.options.openStorage
      ? this.options.openStorage(key)
      : openPiAdminAgentStorage(this.config, key);
  }

  private async acquire(key: string) {
    const before = this.queues.get(key) ?? Promise.resolve();
    let unlock!: () => void;
    const owned = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const tail = before.then(() => owned);
    this.queues.set(key, tail);
    await before;
    return () => {
      unlock();
      if (this.queues.get(key) === tail) this.queues.delete(key);
    };
  }

  private async bootstrapHistory(root: Conversation, input: AdminAgentChatReplyInput) {
    const { context } = await piModules();
    const existing = await root.entries({}, 1, undefined, context);
    if (existing.items.length) return;
    const history = await this.messages.listConversationMessages({
      conversationId: input.conversationId!,
      limit: 100,
    });
    const accepted = history.filter((message) => message.id !== input.requestId);
    await root.commit(async (tx) => {
      for (const [index, message] of accepted.entries()) {
        const timestamp = Date.now() - accepted.length + index;
        let model: Message | undefined;
        if (message.role === "user") model = { role: "user", content: message.content, timestamp };
        if (message.role === "assistant") {
          const content: AssistantMessage["content"] = [];
          if (typeof message.content === "string" && message.content)
            content.push({ type: "text", text: message.content });
          for (const call of message.toolCalls ?? []) {
            try {
              content.push({
                type: "toolCall",
                id: call.id,
                name: call.function.name,
                arguments: JSON.parse(call.function.arguments),
              });
            } catch {
              /* Ignore malformed historical tool arguments. */
            }
          }
          model = {
            role: "assistant",
            content,
            timestamp,
            api: "openai-completions",
            provider: this.modelClient.modelRef.provider,
            model: this.modelClient.modelRef.modelId,
            stopReason: message.toolCalls?.length ? "toolUse" : "stop",
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
          };
        }
        if (message.role === "tool")
          model = {
            role: "toolResult",
            toolCallId: message.toolCallId,
            toolName: "historical-tool",
            content: [{ type: "text", text: message.content }],
            isError: false,
            timestamp,
          };
        if (model)
          await tx.appendEntry(root.id, {
            kind: "az.imported-message",
            model: [model],
            data: { messageId: message.id },
          });
      }
    }, context);
  }

  private async repairProjection(
    root: Conversation,
    conversationId: string,
    actorUserId: string,
    RequestsDoc: ConversationDocToken<ChatRequests>,
    context: Context,
  ) {
    const requests = await root.commit(
      async (tx) => JSON.parse(JSON.stringify(await tx.doc(RequestsDoc, root.id))) as ChatRequests,
      context,
    );
    for (const request of Object.values(requests.requests)) {
      await this.messages.recordMessage({
        actorUserId,
        conversationId,
        message: { id: request.id, role: "user", content: request.content },
      });
    }
    let cursor;
    do {
      const page = await root.entries({ order: "ascending" }, 100, cursor, context);
      for (const entry of page.items) {
        for (const message of persistedEntryMessages(conversationId, entry)) {
          await this.messages.recordMessage({
            conversationId,
            message,
            ...(message.role === "reasoning" && requests.durations[message.id] !== undefined
              ? { durationMs: requests.durations[message.id] }
              : {}),
          });
        }
      }
      cursor = page.next;
    } while (cursor);
  }
}

function hasExplicitWriteIntent(tool: "hide_comments" | "restore_comments", message: string) {
  const verb = tool === "hide_comments" ? "隐藏|屏蔽" : "恢复|还原";
  const target =
    "(?:(?:这些|这批|选中的|全部|所有|刚才分析的|分析结果中的|分析结果里的)(?:违规|风险)?)?评论";
  const prefix = "(?:请(?:帮我)?|帮我|确认|同意|现在|立即)?";
  return (
    new RegExp(`^${prefix}(?:${verb})${target}[。！!]?$`).test(message.trim()) ||
    new RegExp(`^${prefix}把${target}(?:${verb})[。！!]?$`).test(message.trim()) ||
    new RegExp(
      `^(?:please )?${tool === "hide_comments" ? "hide" : "(?:restore|unhide)"} (?:these|the selected|all|those) comments[.!]?$`,
      "i",
    ).test(message.trim())
  );
}

function chatKey(actor: string, conversation: string) {
  return `chat:${actor}:${conversation}`;
}
function messageId(conversation: string, task: number | undefined, message: AssistantMessage) {
  return `pi-${createHash("sha256").update(conversation).digest("hex").slice(0, 16)}-${task ?? 0}-${message.timestamp}`;
}
function textOf(message: Message) {
  return typeof message.content === "string"
    ? message.content
    : message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
}
function thinkingSummary(message: AssistantMessage) {
  return message.content.some((block) => block.type === "thinking")
    ? "正在理解请求并规划执行步骤。"
    : "";
}
function activityOf(message: ToolResultMessage): AdminAgentServerToolResult["activity"] {
  const details = message.details as
    | { activity?: AdminAgentServerToolResult["activity"] }
    | undefined;
  return details?.activity;
}
function* persistedEntryMessages(
  conversation: string,
  entry: EntryRecord,
): Generator<AdminAgentMessage> {
  if (entry.kind === "az.imported-message") return;
  for (const message of entry.model ?? []) {
    if (message.role === "assistant") {
      const id = messageId(conversation, entry.byTaskId, message);
      const reasoning = thinkingSummary(message);
      if (reasoning) yield { id: `${id}-reasoning`, role: "reasoning", content: reasoning };
      const toolCalls = message.content
        .filter((block) => block.type === "toolCall")
        .map((block) => ({
          id: block.id,
          type: "function" as const,
          function: { name: block.name, arguments: JSON.stringify(block.arguments) },
        }));
      if (textOf(message) || toolCalls.length)
        yield {
          id,
          role: "assistant",
          content: textOf(message).slice(0, 12_000),
          ...(toolCalls.length ? { toolCalls } : {}),
        };
    } else if (message.role === "toolResult") {
      yield {
        id: `pi-tool-${entry.id}`,
        role: "tool",
        toolCallId: message.toolCallId,
        content: textOf(message),
      };
      const activity = activityOf(message);
      if (activity) yield activity;
    }
  }
}

class ChatEventProjection {
  private readonly entries = new Set<number>();
  private readonly turns = new Map<
    string,
    {
      text: string;
      reasoning: string;
      tools: Set<string>;
      ended: boolean;
      startedAt?: number;
      durationMs?: number;
    }
  >();
  private completed?: { id: string; durationMs: number };
  completedDuration() {
    return this.completed;
  }
  constructor(private readonly conversation: string) {}
  skip(entries: readonly EntryRecord[]) {
    for (const entry of entries) this.entries.add(entry.id);
  }
  *view(view: ConversationView): Generator<AdminAgentChatRunnerEvent> {
    for (const entry of view.entries) yield* this.entry(entry);
    const live = view.docs["pi.live"] as LiveState | undefined;
    if (live?.generation?.message) {
      yield* this.assistant(live.generation.message as AssistantMessage, live.run?.taskId, false);
    }
  }
  *entry(entry: EntryRecord): Generator<AdminAgentChatRunnerEvent> {
    if (this.entries.has(entry.id)) return;
    this.entries.add(entry.id);
    for (const message of entry.model ?? []) {
      if (message.role === "assistant") yield* this.assistant(message, entry.byTaskId, true);
      if (message.role === "toolResult") {
        yield {
          type: "toolResult",
          messageId: `pi-tool-${entry.id}`,
          toolCallId: message.toolCallId,
          content: textOf(message),
        };
        const activity = activityOf(message);
        if (activity) yield { type: "activity", activity };
      }
    }
  }
  private *assistant(
    message: AssistantMessage,
    task: number | undefined,
    finalized: boolean,
  ): Generator<AdminAgentChatRunnerEvent> {
    const id = messageId(this.conversation, task, message);
    let turn = this.turns.get(id);
    if (turn?.ended) return;
    if (!turn) {
      turn = { text: "", reasoning: "", tools: new Set(), ended: false };
      this.turns.set(id, turn);
      yield { type: "turnStart", messageId: id, reasoningMessageId: `${id}-reasoning` };
    }
    const reasoning = thinkingSummary(message);
    if (reasoning && !turn.reasoning) {
      turn.startedAt = Date.now();
      turn.reasoning = reasoning;
      yield { type: "reasoningDelta", delta: reasoning };
    }
    const text = textOf(message).slice(0, 12_000);
    if (text.length > turn.text.length) {
      if (turn.startedAt !== undefined)
        turn.durationMs ??= Math.max(1, Date.now() - turn.startedAt);
      yield { type: "textDelta", delta: text.slice(turn.text.length) };
      turn.text = text;
    }
    if (finalized) {
      for (const block of message.content) {
        if (block.type !== "toolCall" || turn.tools.has(block.id)) continue;
        turn.tools.add(block.id);
        yield { type: "toolCallStart", toolCallId: block.id, toolCallName: block.name };
        yield {
          type: "toolCallArgsDelta",
          toolCallId: block.id,
          delta: JSON.stringify(block.arguments),
        };
        yield { type: "toolCallEnd", toolCallId: block.id };
      }
      turn.ended = true;
      this.completed =
        turn.startedAt === undefined
          ? undefined
          : {
              id: `${id}-reasoning`,
              durationMs: turn.durationMs ?? Math.max(1, Date.now() - turn.startedAt),
            };
      yield {
        type: "turnEnd",
        ...(this.completed ? { reasoningDurationMs: this.completed.durationMs } : {}),
      };
    }
  }
}

class AsyncQueue<T> {
  private readonly items: T[] = [];
  private wake?: () => void;
  private ended = false;
  private failure?: Error;
  push(value: T) {
    this.items.push(value);
    this.wake?.();
  }
  end(error?: Error) {
    this.ended = true;
    this.failure = error;
    this.wake?.();
  }
  async next(signal?: AbortSignal): Promise<T | undefined> {
    while (!this.items.length && !this.ended) {
      signal?.throwIfAborted();
      await new Promise<void>((resolve) => {
        const wake = () => {
          signal?.removeEventListener("abort", wake);
          resolve();
        };
        this.wake = wake;
        signal?.addEventListener("abort", wake, { once: true });
      });
      this.wake = undefined;
    }
    signal?.throwIfAborted();
    const item = this.items.shift();
    if (item) return item;
    if (this.failure) throw this.failure;
    return undefined;
  }
}

export { PiAdminAgentChatRunner, PI_ADMIN_AGENT_CHAT_OPTIONS };
