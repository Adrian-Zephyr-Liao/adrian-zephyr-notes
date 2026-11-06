import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxThinking,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { AssistantToolResult } from "@adrian-zephyr-notes/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  AssistantRunnerInput,
  AssistantRuntimeEvent,
  AssistantToolDefinition,
} from "../application/assistant-runner.port";
import type { PiAssistantModelClient } from "./pi-assistant-model.client";
import { PiAssistantRunner } from "./pi-assistant.runner";
import { projectAssistantTranscript } from "./pi-assistant-projector";

const result: AssistantToolResult = {
  kind: "audit_logs",
  ok: true,
  data: {
    data: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    filters: { action: "ALL", actorLogin: null, search: null },
    queriedAt: "2026-11-06T00:00:00.000Z",
  },
};
function fixture(limits: ConstructorParameters<typeof PiAssistantRunner>[1] = {}) {
  const faux = fauxProvider({ models: [{ id: "faux-1", contextWindow: 32768, maxTokens: 4096 }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const model = {
    ready: async () => {},
    assertConfigured: () => {},
    model: faux.getModel(),
    models,
    maxOutputTokens: 4096,
    requestOptions: () => ({ maxTokens: 4096 }),
  } as unknown as PiAssistantModelClient;
  const execute = vi.fn(async () => result);
  const tool: AssistantToolDefinition = {
    name: "list_audit_logs",
    label: "查询日志",
    description: "Read audit logs",
    parameters: { type: "object", additionalProperties: false },
    kind: "audit_logs",
    readOnly: true,
    execute,
  };
  return { runner: new PiAssistantRunner(model, limits), faux, execute, tool };
}
function input(overrides: Partial<AssistantRunnerInput> = {}): AssistantRunnerInput {
  return { turnId: "turn-1", message: "查看审计日志", messages: [], tools: [], ...overrides };
}
async function collect(stream: AsyncIterable<AssistantRuntimeEvent>) {
  const events: AssistantRuntimeEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}
function finished(events: AssistantRuntimeEvent[]) {
  return events.findLast((event) => event.type === "finished")!;
}

describe("PiAssistantRunner", () => {
  it("uses the real Pi loop, persists messages before result events, and projects stable public IDs without thinking", async () => {
    const f = fixture();
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxThinking("private thought"), fauxToolCall("list_audit_logs", {}, { id: "call_1" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("日志查询完成。"),
    ]);
    const authorizeTool = vi.fn(async () => {});
    const events = await collect(f.runner.stream(input({ tools: [f.tool], authorizeTool })));
    expect(f.execute).toHaveBeenCalledOnce();
    expect(authorizeTool).toHaveBeenCalledOnce();
    expect(f.execute.mock.calls[0]).toEqual([
      {},
      expect.objectContaining({
        turnId: "turn-1",
        toolCallId: "turn-1:1:call_1",
        signal: expect.any(AbortSignal),
      }),
    ]);
    const index = events.findIndex((event) => event.type === "toolResult");
    expect(events[index - 1]?.type).toBe("messages");
    const final = finished(events);
    expect(final.status).toBe("SUCCEEDED");
    expect(final.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    const projected = projectAssistantTranscript("turn-1", final.messages);
    expect(projected.messages).toEqual([
      { id: "turn-1:message:0", role: "user", content: "查看审计日志" },
      { id: "turn-1:message:3", role: "assistant", content: "日志查询完成。" },
    ]);
    expect(projected.toolResults).toEqual([
      { toolCallId: "turn-1:1:call_1", name: "list_audit_logs", result },
    ]);
    expect(JSON.stringify(projected)).not.toContain("private thought");
    expect(events).toContainEqual({ type: "textEnd", messageId: "turn-1:message:3" });
  });

  it("waits for the message persistence consumer before a model or tool call proceeds", async () => {
    const f = fixture();
    f.faux.setResponses([
      fauxAssistantMessage([fauxToolCall("list_audit_logs", {}, { id: "call_1" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("完成"),
    ]);
    const iterator = f.runner.stream(input({ tools: [f.tool] }));
    expect((await iterator.next()).value).toMatchObject({
      type: "messages",
      messages: [{ role: "user" }],
    });
    expect(f.faux.state.callCount).toBe(0);
    expect((await iterator.next()).value).toMatchObject({
      type: "messages",
      messages: [{ role: "user" }, { role: "assistant" }],
    });
    expect(f.execute).not.toHaveBeenCalled();
    for await (const _event of iterator) {
      /* drain */
    }
    expect(f.execute).toHaveBeenCalledOnce();
  });

  it("does not expose supplied history as this turn's new messages", async () => {
    const f = fixture();
    f.faux.setResponses([
      (context) => {
        expect(JSON.stringify(context)).toContain("旧问题");
        return fauxAssistantMessage("新回答");
      },
    ]);
    const events = await collect(
      f.runner.stream(
        input({
          messages: [
            { role: "user", content: "旧问题", timestamp: 1 },
            fauxAssistantMessage("旧回答"),
          ],
        }),
      ),
    );
    expect(finished(events).messages).toHaveLength(2);
    expect(finished(events).messages[0]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "查看审计日志" }],
    });
  });

  it("rejects invalid tool arguments and actor-supplied properties without querying business data", async () => {
    const f = fixture();
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxToolCall("list_audit_logs", { actor: "another-admin" }, { id: "bad" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("参数无效"),
    ]);
    const events = await collect(f.runner.stream(input({ tools: [f.tool] })));
    expect(f.execute).not.toHaveBeenCalled();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "toolResult",
        result: {
          kind: "audit_logs",
          ok: false,
          error: { code: "TOOL_INPUT_INVALID", message: "工具输入无效或当前不允许执行。" },
        },
      }),
    );
  });

  it("checks current authorization before executing a registered tool", async () => {
    const f = fixture();
    f.faux.setResponses([
      fauxAssistantMessage([fauxToolCall("list_audit_logs", {}, { id: "denied" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("权限已失效"),
    ]);
    await collect(
      f.runner.stream(
        input({
          tools: [f.tool],
          authorizeTool: () => {
            throw new Error("Session revoked");
          },
        }),
      ),
    );
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each(["MODEL_CALL_LIMIT", "TOOL_CALL_LIMIT"])(
    "enforces %s without an extra model/business call",
    async (code) => {
      const f = fixture({
        limits: code === "MODEL_CALL_LIMIT" ? { maxModelCalls: 1 } : { maxToolCalls: 1 },
      });
      f.faux.setResponses([
        fauxAssistantMessage(
          [
            fauxToolCall("list_audit_logs", {}, { id: "one" }),
            ...(code === "TOOL_CALL_LIMIT"
              ? [fauxToolCall("list_audit_logs", {}, { id: "two" })]
              : []),
          ],
          { stopReason: "toolUse" },
        ),
      ]);
      const events = await collect(f.runner.stream(input({ tools: [f.tool] })));
      expect(finished(events)).toMatchObject({ status: "FAILED", error: { code } });
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.faux.state.callCount).toBe(1);
    },
  );

  it.each(["cancel", "timeout"])(
    "propagates %s to the model and waits for it to settle",
    async (mode) => {
      const f = fixture({ limits: { totalTimeoutMs: mode === "timeout" ? 20 : 1000 } });
      let started!: () => void;
      const reached = new Promise<void>((resolve) => {
        started = resolve;
      });
      let aborted = false;
      f.faux.setResponses([
        (_context, options) =>
          new Promise((_, reject) => {
            started();
            options!.signal!.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(options!.signal!.reason);
              },
              { once: true },
            );
          }),
      ]);
      const controller = new AbortController();
      const work = collect(f.runner.stream(input({ signal: controller.signal })));
      await reached;
      if (mode === "cancel") controller.abort();
      const events = await work;
      expect(aborted).toBe(true);
      expect(finished(events)).toMatchObject(
        mode === "cancel"
          ? { status: "CANCELLED" }
          : { status: "FAILED", error: { code: "REQUEST_TIMEOUT" } },
      );
    },
  );

  it("fails an oversized tool response without persisting or exposing its body", async () => {
    const f = fixture({ limits: { maxToolResultBytes: 100 } });
    f.faux.setResponses([
      fauxAssistantMessage([fauxToolCall("list_audit_logs", {}, { id: "large" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("请减少每页条数"),
    ]);
    const events = await collect(f.runner.stream(input({ tools: [f.tool] })));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "toolResult",
        result: {
          kind: "audit_logs",
          ok: false,
          error: { code: "TOOL_RESULT_LIMIT", message: "结果过大，请缩小查询范围或减少每页条数。" },
        },
      }),
    );
  });

  it("retains an accepted user message when already cancelled, without starting the model", async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    const events = await collect(f.runner.stream(input({ signal: controller.signal })));
    expect(finished(events).status).toBe("CANCELLED");
    expect(finished(events).messages[0]?.role).toBe("user");
    expect(f.faux.state.callCount).toBe(0);
  });

  it("caps the streamed and persisted output even when a provider chunk crosses the limit", async () => {
    const f = fixture({ limits: { maxOutputChars: 3 } });
    f.faux.setResponses([fauxAssistantMessage("abcdefghijklmnopqrstuvwxyz")]);
    const events = await collect(f.runner.stream(input()));
    expect(finished(events)).toMatchObject({ status: "FAILED", error: { code: "OUTPUT_LIMIT" } });
    const text = events
      .flatMap((event) => (event.type === "textDelta" ? event.delta : []))
      .join("");
    expect(text).toHaveLength(3);
    const projected = projectAssistantTranscript("turn-1", finished(events).messages);
    expect(projected.messages.find((message) => message.role === "assistant")?.content).toBe(text);
  });

  it("rejects an oversized canonical context before requesting the provider", async () => {
    const f = fixture({ limits: { maxInputTokens: 10 } });
    const events = await collect(f.runner.stream(input()));
    expect(finished(events)).toMatchObject({
      status: "FAILED",
      error: { code: "INPUT_TOKEN_LIMIT" },
    });
    expect(f.faux.state.callCount).toBe(0);
  });

  it("namespaces reused provider call IDs by assistant message and passes the same identities to action previews", async () => {
    const f = fixture();
    const execute = vi.fn<AssistantToolDefinition["execute"]>(
      async () =>
        ({
          kind: "comment_action",
          ok: false,
          error: { code: "PREVIEW_TEST", message: "测试预览" },
        }) as AssistantToolResult,
    );
    const preview: AssistantToolDefinition = {
      name: "prepare_comment_moderation",
      label: "预览",
      description: "Preview only",
      parameters: { type: "object" },
      kind: "comment_action",
      readOnly: false,
      execute,
    };
    f.faux.setResponses([
      fauxAssistantMessage([fauxToolCall(preview.name, { commentId: "first" }, { id: "call_1" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage(
        [fauxToolCall(preview.name, { commentId: "second" }, { id: "call_1" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("请在预览卡片确认。"),
    ]);
    const events = await collect(f.runner.stream(input({ tools: [preview] })));
    const starts = events.flatMap((event) =>
      event.type === "toolStart" ? [event.toolCallId] : [],
    );
    expect(starts).toEqual(["turn-1:1:call_1", "turn-1:3:call_1"]);
    expect(execute.mock.calls.map((call) => call[1].toolCallId)).toEqual(starts);
    const projected = projectAssistantTranscript("turn-1", finished(events).messages);
    expect(projected.toolResults.map((entry) => entry.toolCallId)).toEqual(starts);
    expect(
      finished(events)
        .messages.filter((message) => message.role === "toolResult")
        .map((message) => message.toolCallId),
    ).toEqual(["call_1", "call_1"]);
  });

  it("rejects duplicate provider IDs inside the same assistant response before business execution", async () => {
    const f = fixture();
    f.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall(f.tool.name, {}, { id: "duplicate" }),
          fauxToolCall(f.tool.name, {}, { id: "duplicate" }),
        ],
        { stopReason: "toolUse" },
      ),
    ]);
    const events = await collect(f.runner.stream(input({ tools: [f.tool] })));
    expect(f.execute).not.toHaveBeenCalled();
    expect(finished(events)).toMatchObject({
      status: "FAILED",
      error: { code: "DUPLICATE_TOOL_CALL_ID" },
    });
    expect(events.filter((event) => event.type === "toolStart")).toHaveLength(0);
  });
});
