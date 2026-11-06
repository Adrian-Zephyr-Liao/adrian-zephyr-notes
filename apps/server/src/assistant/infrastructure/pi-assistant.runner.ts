import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import type { AssistantError, AssistantToolResult } from "@adrian-zephyr-notes/contracts";
import {
  type AssistantRunner,
  type AssistantRunnerInput,
  type AssistantRuntimeEvent,
  type AssistantToolsContext,
} from "../application/assistant-runner.port";
import type { AssistantTranscript } from "../domain/assistant.repository";
import { AssistantToolInputError, AssistantToolsRegistry } from "./assistant-tools.registry";
import { PiAssistantModelClient } from "./pi-assistant-model.client";
import { buildAssistantSystemPrompt } from "./pi-assistant-prompt";
import {
  assistantMessageId,
  assistantMessageText,
  assistantToolCallId,
  isAssistantToolResult,
  projectAssistantTranscript,
  readAssistantMessages,
  refreshActionMessages,
} from "./pi-assistant-projector";

const defaultLimits = {
  totalTimeoutMs: 60000,
  maxModelCalls: 6,
  maxToolCalls: 8,
  maxInputChars: 2000,
  maxInputTokens: 24000,
  maxOutputChars: 12000,
  maxToolResultBytes: 24000,
};
type RuntimeOptions = { limits?: Partial<typeof defaultLimits>; now?: () => Date };
export const PI_ASSISTANT_RUNTIME_OPTIONS = Symbol("PI_ASSISTANT_RUNTIME_OPTIONS");

@Injectable()
export class PiAssistantRunner implements AssistantRunner {
  constructor(
    private readonly modelClient: PiAssistantModelClient,
    private readonly tools: AssistantToolsRegistry,
    @Optional() @Inject(PI_ASSISTANT_RUNTIME_OPTIONS) private readonly options: RuntimeOptions = {},
  ) {}

  isConfigured() {
    return this.modelClient.isConfigured();
  }

  capabilities(context: AssistantToolsContext) {
    return this.definitions(context).map(({ name, label, description, readOnly }) => ({
      name,
      label,
      description,
      readOnly,
    }));
  }

  project(turnId: string, transcript: AssistantTranscript) {
    return projectAssistantTranscript(turnId, readAssistantMessages(transcript.messages));
  }

  private definitions(context: AssistantToolsContext) {
    return this.tools.create(context).filter((tool) => context.actionsEnabled || tool.readOnly);
  }

  async *stream(input: AssistantRunnerInput): AsyncGenerator<AssistantRuntimeEvent> {
    const limits = { ...defaultLimits, ...this.options.limits };
    if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1))
      throw new Error("Invalid assistant runtime limits.");
    if (!input.turnId || !input.message.trim() || input.message.length > limits.maxInputChars)
      throw new Error("Invalid assistant input length.");
    const messages = refreshActionMessages(
      readAssistantMessages(input.transcripts.flatMap((transcript) => transcript.messages)),
      input.actions,
    );
    const tools = this.definitions(input);
    const canonical: Message[] = [];
    const channel = new RuntimeChannel<AssistantRuntimeEvent>();
    let failure: AssistantError | undefined;
    let modelCalls = 0;
    let toolCalls = 0;
    let outputChars = 0;
    let assistantIndex = 0;
    let assistantTextBudget = limits.maxOutputChars;
    let textOpen = false;
    let invalidAssistantCalls = false;
    let consumerClosed = false;
    const models = await this.modelClient.ready();
    this.modelClient.assertConfigured();
    const [{ Agent }, { estimateMessageTokens }] = await Promise.all([
      import("@earendil-works/pi-agent-core"),
      import("@earendil-works/pi-ai/utils/estimate"),
    ]);
    const agent = new Agent({
      identity: { attribution: null },
      toolExecution: "sequential",
      initialState: {
        model: this.modelClient.model,
        thinkingLevel: "off",
        systemPrompt: buildAssistantSystemPrompt(this.options.now?.()),
        messages: structuredClone(messages),
        tools: tools.map((tool) => ({
          name: tool.name,
          label: tool.label,
          description: tool.description,
          parameters: tool.parameters,
          execute: async (providerCallId, args, signal) => {
            const context = {
              turnId: input.turnId,
              toolCallId: assistantToolCallId(input.turnId, providerCallId, assistantIndex),
              signal: signal!,
            };
            let result: AssistantToolResult;
            try {
              signal?.throwIfAborted();
              result = await tool.execute(args as Record<string, unknown>, context);
              signal?.throwIfAborted();
              if (!isAssistantToolResult(result)) throw new Error("Invalid tool result.");
              if (Buffer.byteLength(JSON.stringify(result), "utf8") > limits.maxToolResultBytes) {
                result = {
                  kind: tool.kind,
                  ok: false,
                  error: {
                    code: "TOOL_RESULT_LIMIT",
                    message: "结果过大，请缩小查询范围或减少每页条数。",
                  },
                };
              }
            } catch (error) {
              result = {
                kind: tool.kind,
                ok: false,
                error:
                  error instanceof AssistantToolInputError
                    ? { code: error.code, message: error.message }
                    : { code: "TOOL_FAILED", message: "工具未能完成，请检查输入或稍后重试。" },
              };
            }
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
              details: result,
              isError: !result.ok,
            };
          },
        })),
      },
      streamFn: (model, context, options) => {
        options?.signal?.throwIfAborted();
        return models.streamSimple(model, context, {
          ...options,
          ...this.modelClient.requestOptions(),
        });
      },
      prepareRequest: async ({ context }) => {
        if (++modelCalls > limits.maxModelCalls) {
          stop("MODEL_CALL_LIMIT", "模型调用次数已达到本次请求上限。");
          throw new Error("Model call limit");
        }
        const budget = Math.min(
          limits.maxInputTokens,
          this.modelClient.model.contextWindow - this.modelClient.maxOutputTokens,
        );
        if (
          context.messages.reduce((total, message) => total + estimateMessageTokens(message), 0) >
          budget
        ) {
          stop("INPUT_TOKEN_LIMIT", "对话已超过输入预算，请新建会话或缩小问题范围。");
          throw new Error("Input token limit");
        }
      },
      beforeToolCall: async ({ toolCall, args }, signal) => {
        signal?.throwIfAborted();
        if (++toolCalls > limits.maxToolCalls) {
          stop("TOOL_CALL_LIMIT", "工具调用次数已达到本次请求上限。");
          return { block: true, reason: "Tool call limit", terminate: true };
        }
        try {
          await input.authorizeTool?.(toolCall.name, args, signal!);
          signal?.throwIfAborted();
        } catch {
          if (!signal?.aborted)
            stop("TOOL_AUTHORIZATION_FAILED", "执行权限已失效，本次请求已停止。");
          return {
            block: true,
            reason: "This tool is not authorized for this request.",
            terminate: true,
          };
        }
      },
    });
    function stop(code: string, message: string) {
      failure ??= { code, message };
      agent.abort();
    }
    const onAbort = () => agent.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(
      () => stop("REQUEST_TIMEOUT", "请求已达到总时限。"),
      limits.totalTimeoutMs,
    );
    timer.unref?.();
    const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
      if (consumerClosed) return;
      if (event.type === "message_start" && event.message.role === "assistant") {
        assistantIndex = canonical.length;
        assistantTextBudget = limits.maxOutputChars - outputChars;
        textOpen = false;
        invalidAssistantCalls = false;
      } else if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        const source = event.assistantMessageEvent.delta;
        const delta = source.slice(0, Math.max(0, limits.maxOutputChars - outputChars));
        outputChars += delta.length;
        if (delta) {
          if (!textOpen) {
            textOpen = true;
            await channel.send({
              type: "textStart",
              messageId: assistantMessageId(input.turnId, assistantIndex),
            });
          }
          await channel.send({
            type: "textDelta",
            messageId: assistantMessageId(input.turnId, assistantIndex),
            delta,
          });
        }
        if (delta.length < source.length) stop("OUTPUT_LIMIT", "回复已达到本次请求的长度上限。");
      } else if (event.type === "tool_execution_start") {
        if (invalidAssistantCalls) return;
        await channel.send({
          type: "toolStart",
          toolCallId: assistantToolCallId(input.turnId, event.toolCallId, assistantIndex),
          parentMessageId: assistantMessageId(input.turnId, assistantIndex),
          name: event.toolName,
          args: event.args,
        });
      } else if (
        event.type === "message_end" &&
        ["user", "assistant", "toolResult"].includes(event.message.role)
      ) {
        const message = structuredClone(event.message) as Message;
        if (message.role === "toolResult" && invalidAssistantCalls) return;
        if (message.role === "assistant") {
          const calls = message.content.filter((block) => block.type === "toolCall");
          if (new Set(calls.map((call) => call.id)).size !== calls.length) {
            invalidAssistantCalls = true;
            message.content = message.content.filter((block) => block.type !== "toolCall");
            message.stopReason = "error";
            stop("DUPLICATE_TOOL_CALL_ID", "模型返回了重复的工具调用身份，已拒绝执行。");
          }
          let remaining = assistantTextBudget;
          message.content = message.content.map((block) => {
            if (block.type !== "text") return block;
            const text = block.text.slice(0, Math.max(0, remaining));
            remaining -= text.length;
            return { ...block, text };
          });
        }
        if (message.role === "toolResult" && !isAssistantToolResult(message.details)) {
          const tool = tools.find((candidate) => candidate.name === message.toolName);
          if (tool) {
            message.details = {
              kind: tool.kind,
              ok: false,
              error: { code: "TOOL_INPUT_INVALID", message: "工具输入无效或当前不允许执行。" },
            } satisfies AssistantToolResult;
            message.content = [{ type: "text", text: JSON.stringify(message.details) }];
          }
        }
        canonical.push(message);
        // Await consumer advancement: the application saves progress before public completion/result events.
        await channel.send({ type: "messages", messages: structuredClone(canonical) });
        if (message.role === "assistant" && textOpen) {
          textOpen = false;
          await channel.send({
            type: "textEnd",
            messageId: assistantMessageId(input.turnId, assistantIndex),
          });
        } else if (message.role === "toolResult") {
          await channel.send({
            type: "toolResult",
            messageId: `${input.turnId}:result:${assistantToolCallId(input.turnId, message.toolCallId, assistantIndex)}`,
            toolCallId: assistantToolCallId(input.turnId, message.toolCallId, assistantIndex),
            name: message.toolName,
            content: assistantMessageText(message),
          });
        }
      }
    });
    const work = agent
      .prompt(input.message)
      .catch(() => {
        failure ??= { code: "MODEL_REQUEST_FAILED", message: "模型请求失败，请稍后重试。" };
      })
      .finally(() => channel.finish());
    if (input.signal?.aborted) agent.abort();
    try {
      for (;;) {
        const delivery = await channel.next();
        if (!delivery) break;
        try {
          yield delivery.event;
        } finally {
          delivery.ack();
        }
      }
      await work;
      const last = canonical.findLast((message) => message.role === "assistant");
      if (
        !failure &&
        !input.signal?.aborted &&
        (!last || last.stopReason === "error" || last.stopReason === "aborted")
      )
        failure = { code: "MODEL_REQUEST_FAILED", message: "模型请求未能完成。" };
      yield {
        type: "finished",
        status: failure ? "FAILED" : input.signal?.aborted ? "CANCELLED" : "SUCCEEDED",
        messages: structuredClone(canonical),
        ...(failure ? { error: failure } : {}),
      };
    } finally {
      consumerClosed = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      unsubscribe();
      agent.abort();
      channel.close();
      await work;
    }
  }
}

class RuntimeChannel<T> {
  private queue: Array<{ event: T; ack(): void; reject(error: Error): void }> = [];
  private wake?: () => void;
  private ended = false;
  send(event: T): Promise<void> {
    if (this.ended) return Promise.reject(new Error("Assistant stream closed."));
    return new Promise((ack, reject) => {
      this.queue.push({ event, ack, reject });
      this.wake?.();
    });
  }
  async next() {
    while (!this.queue.length && !this.ended)
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    return this.queue.shift();
  }
  finish() {
    this.ended = true;
    this.wake?.();
  }
  close() {
    this.finish();
    for (const delivery of this.queue.splice(0))
      delivery.reject(new Error("Assistant stream closed."));
  }
}
