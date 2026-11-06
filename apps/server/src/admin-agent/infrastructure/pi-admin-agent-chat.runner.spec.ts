import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { ConfigService } from "@nestjs/config";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxThinking,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { estimateMessageTokens } from "@earendil-works/pi-ai/utils/estimate";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";
import type {
  AdminAgentChatMessageRepository,
  AdminAgentMessage,
} from "../domain/admin-agent-chat-message.repository";
import type {
  AdminAgentChatReplyInput,
  AdminAgentServerTool,
} from "../domain/admin-agent-chat-runner";
import { PiAdminAgentChatRunner } from "./pi-admin-agent-chat.runner";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture({ contextWindow = 32768, maxOutputTokens = 8192 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "az-pi-chat-"));
  directories.push(directory);
  const faux = fauxProvider({
    models: [{ id: "faux-1", contextWindow, maxTokens: maxOutputTokens }],
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const records = new Map<string, AdminAgentMessage>();
  const ownership: AbortController[] = [];
  const repository = {
    assertConversationAccess: vi.fn(async () => {}),
    recordMessage: vi.fn(async (input) => {
      records.set(input.message.id, input.message);
    }),
    listConversationMessages: vi.fn(async () => [...records.values()]),
  } satisfies AdminAgentChatMessageRepository;
  const client = {
    ready: async () => {},
    assertConfigured: () => {},
    models,
    modelRef: { provider: "faux", modelId: "faux-1" },
    contextWindow,
    maxOutputTokens,
  } as unknown as PiAdminAgentModelClient;
  const openStorage = async () => {
    const storage = await openNodeSqliteStorage(join(directory, "session.sqlite"));
    const owner = new AbortController();
    ownership.push(owner);
    return {
      storage,
      ownershipLost: owner.signal,
      close: async () => {
        await storage.close(BACKGROUND_CONTEXT);
      },
    };
  };
  const create = (storageFactory = openStorage) =>
    new PiAdminAgentChatRunner(client, new ConfigService(), repository, {
      openStorage: storageFactory,
    });
  return { runner: create(), create, faux, records, repository, ownership, openStorage };
}

const input = (overrides: Partial<AdminAgentChatReplyInput> = {}): AdminAgentChatReplyInput => ({
  actorUserId: "admin-1",
  conversationId: "conversation-1",
  requestId: "user-1",
  runId: "run-1",
  context: [],
  recentMessages: [],
  message: "分析今天的评论",
  ...overrides,
});
async function collect<T>(stream: AsyncIterable<T>) {
  const result: T[] = [];
  for await (const value of stream) result.push(value);
  return result;
}

async function suspendGeneration(f: Awaited<ReturnType<typeof fixture>>) {
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.faux.setResponses([
    (_context, options) =>
      new Promise((_, reject) => {
        reached();
        options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
          once: true,
        });
      }),
  ]);
  const detach = new AbortController();
  const interrupted = collect(f.runner.streamReply(input({ signal: detach.signal })));
  await started;
  detach.abort();
  await expect(interrupted).rejects.toThrow();
}

async function runningAnalysis(
  f: Awaited<ReturnType<typeof fixture>>,
  cancel: NonNullable<AdminAgentServerTool["cancel"]> = vi.fn(async () => {}),
) {
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const execute = vi.fn<AdminAgentServerTool["execute"]>(
    (_args, context) =>
      new Promise<{ content: string }>((_, reject) => {
        reached();
        context.signal!.addEventListener("abort", () => reject(context.signal!.reason), {
          once: true,
        });
      }),
  );
  const tool: AdminAgentServerTool = {
    name: "analyze_comments",
    description: "Analyze",
    parameters: { type: "object" },
    execute,
    cancel,
  };
  f.faux.setResponses([
    fauxAssistantMessage([fauxToolCall("analyze_comments", {}, { id: "analysis-call" })], {
      stopReason: "toolUse",
    }),
  ]);
  const detach = new AbortController();
  const run = collect(f.runner.streamReply(input({ serverTools: [tool], signal: detach.signal })));
  await started;
  return { tool, detach, run, execute, cancel };
}

describe("PiAdminAgentChatRunner", () => {
  it.each([false, true])(
    "durably cancels a queued write request after Stop, disconnected=%s",
    async (disconnected) => {
      const f = await fixture();
      const analysis = await runningAnalysis(f);
      const execute = vi.fn(async () => ({ content: "Hidden" }));
      const write: AdminAgentServerTool = {
        name: "hide_comments",
        description: "Hide",
        parameters: { type: "object" },
        execute,
      };
      const queuedInput = input({
        requestId: "queued-write",
        message: "请隐藏这些评论",
        serverTools: [write],
      });
      const queuedSignal = new AbortController();
      const queued = collect(
        f.runner.streamReply({ ...queuedInput, signal: queuedSignal.signal }),
      ).catch((error: unknown) => error);
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (disconnected) queuedSignal.abort();
      await f.runner.abortConversation("admin-1", "conversation-1", [analysis.tool]);
      expect(await queued).toContainEqual({ type: "cancelled" });
      await analysis.run;
      f.faux.setResponses([
        fauxAssistantMessage([fauxToolCall("hide_comments", {}, { id: "write-replay" })], {
          stopReason: "toolUse",
        }),
        fauxAssistantMessage("已隐藏。"),
      ]);
      const replay = await collect(f.create().streamReply(queuedInput));
      expect(replay).toContainEqual({ type: "cancelled" });
      expect(execute).not.toHaveBeenCalled();
      expect(f.faux.state.callCount).toBe(1);
      await expect(
        collect(f.create().streamReply({ ...queuedInput, message: "不同的内容" })),
      ).rejects.toThrow("cannot be reused");
      f.faux.setResponses([fauxAssistantMessage("新请求正常完成。")]);
      expect(
        await collect(
          f.create().streamReply(input({ requestId: "fresh-user", message: "新问题" })),
        ),
      ).toContainEqual({ type: "textDelta", delta: "新请求正常完成。" });
      expect(f.faux.state.callCount).toBe(2);
    },
  );

  it.each([false, true])(
    "cancels all HTTP requests already queued before Stop, including cancellation failure=%s",
    async (failCancellation) => {
      const f = await fixture();
      const cancel = vi.fn(async () => {});
      if (failCancellation) cancel.mockRejectedValueOnce(new Error("Cancellation failed"));
      const analysis = await runningAnalysis(f, cancel);
      const queuedTool: AdminAgentServerTool = {
        name: "search_comments",
        description: "Search",
        parameters: { type: "object" },
        execute: vi.fn(async () => ({ content: "Queued search executed" })),
      };
      f.faux.appendResponses([
        fauxAssistantMessage([fauxToolCall("search_comments", {}, { id: "queued-1" })], {
          stopReason: "toolUse",
        }),
        fauxAssistantMessage("Queued answer one"),
        fauxAssistantMessage([fauxToolCall("search_comments", {}, { id: "queued-2" })], {
          stopReason: "toolUse",
        }),
        fauxAssistantMessage("Queued answer two"),
      ]);
      const queued = ["user-2", "user-3"].map((requestId) =>
        collect(
          f.runner.streamReply(
            input({
              requestId,
              message: `Queued ${requestId}`,
              serverTools: [analysis.tool, queuedTool],
            }),
          ),
        ),
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      const stopped = await f.runner
        .abortConversation("admin-1", "conversation-1", [analysis.tool])
        .catch((error: unknown) => error);
      for (const events of await Promise.all([analysis.run, ...queued])) {
        expect(events).toContainEqual({ type: "cancelled" });
      }
      expect(queuedTool.execute).not.toHaveBeenCalled();
      expect(f.faux.state.callCount).toBe(1);
      expect(cancel).toHaveBeenCalledOnce();
      if (failCancellation) {
        expect(stopped).toMatchObject({ message: "Cancellation failed" });
        await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
        expect(cancel).toHaveBeenCalledTimes(2);
      } else expect(stopped).toBeUndefined();
      f.faux.setResponses([fauxAssistantMessage("Stop 后的新问题正常回答。")]);
      const fresh = await collect(
        f.runner.streamReply(input({ requestId: "user-4", message: "新问题" })),
      );
      expect(fresh).toContainEqual({ type: "textDelta", delta: "Stop 后的新问题正常回答。" });
      expect(f.faux.state.callCount).toBe(2);
    },
  );

  it("suspends an analysis tool on disconnect without cancelling its durable business run", async () => {
    const f = await fixture();
    const analysis = await runningAnalysis(f);
    analysis.detach.abort();
    await expect(analysis.run).rejects.toThrow();
    expect(analysis.cancel).not.toHaveBeenCalled();
    expect(analysis.execute).toHaveBeenCalledOnce();
  });

  it("shares concurrent active Stops and waits for durable business cancellation before closing", async () => {
    const f = await fixture();
    let reached!: () => void;
    const cancelling = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const cancel = vi.fn(async () => {
      reached();
      await gate;
    });
    const analysis = await runningAnalysis(f, cancel);
    const first = f.runner.abortConversation("admin-1", "conversation-1", [analysis.tool]);
    const second = f.runner.abortConversation("admin-1", "conversation-1", [analysis.tool]);
    await cancelling;
    expect(cancel).toHaveBeenCalledOnce();
    finish();
    await Promise.all([first, second, analysis.run]);
    expect(cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conversation-1",
        toolCallId: expect.stringMatching(/^[0-9]+:analysis-call$/),
      }),
    );
    await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("cancels a suspended analysis through offline Stop without replaying its execution", async () => {
    const f = await fixture();
    const analysis = await runningAnalysis(f);
    analysis.detach.abort();
    await expect(analysis.run).rejects.toThrow();
    await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
    expect(analysis.cancel).toHaveBeenCalledOnce();
    expect(analysis.execute).toHaveBeenCalledOnce();
    expect(f.faux.state.callCount).toBe(1);
  });

  it("shares an in-flight cancellation failure with a Stop arriving during stream teardown", async () => {
    const f = await fixture();
    let reached!: () => void;
    const cancelling = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let rejectCancellation!: (error: Error) => void;
    const gate = new Promise<void>((_, reject) => {
      rejectCancellation = reject;
    });
    const cancel = vi.fn(async () => {
      reached();
      await gate;
    });
    const analysis = await runningAnalysis(f, cancel);
    const first = f.runner
      .abortConversation("admin-1", "conversation-1", [analysis.tool])
      .catch((error: unknown) => error);
    await cancelling;
    const second = f.runner
      .abortConversation("admin-1", "conversation-1", [analysis.tool])
      .catch((error: unknown) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    rejectCancellation(new Error("Cancellation storage failed"));
    expect(await first).toMatchObject({ message: "Cancellation storage failed" });
    expect(await second).toMatchObject({ message: "Cancellation storage failed" });
    await analysis.run;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(["stop", "stream"])(
    "retries a persisted failed business cancellation on %s reopen",
    async (mode) => {
      const f = await fixture();
      const cancel = vi.fn(async () => {});
      cancel.mockRejectedValueOnce(new Error("Business cancellation unavailable"));
      const analysis = await runningAnalysis(f, cancel);
      await expect(
        f.runner.abortConversation("admin-1", "conversation-1", [analysis.tool]),
      ).rejects.toThrow("Business cancellation unavailable");
      await analysis.run;
      if (mode === "stop") {
        await expect(f.create().abortConversation("admin-1", "conversation-1")).rejects.toThrow(
          "Pending cancellation requires the registered analyze_comments tool",
        );
        await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
      } else {
        f.faux.setResponses([fauxAssistantMessage("继续处理新问题。")]);
        await collect(
          f
            .create()
            .streamReply(
              input({ requestId: "user-2", message: "新问题", serverTools: [analysis.tool] }),
            ),
        );
      }
      expect(cancel).toHaveBeenCalledTimes(2);
      expect(cancel.mock.calls[0]).toEqual(cancel.mock.calls[1]);
      await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
      expect(cancel).toHaveBeenCalledTimes(2);
    },
  );

  it("drains and verifies cancellations after Stop waits for a chat that is still opening", async () => {
    const f = await fixture();
    const cancel = vi.fn(async () => {});
    cancel.mockRejectedValueOnce(new Error("First cancellation attempt failed"));
    const analysis = await runningAnalysis(f, cancel);
    analysis.detach.abort();
    await expect(analysis.run).rejects.toThrow();
    let reached!: () => void;
    const opening = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner = f.create(async () => {
      reached();
      await gate;
      return f.openStorage();
    });
    const stream = collect(
      runner.streamReply(input({ requestId: "user-2", serverTools: [analysis.tool] })),
    );
    const streamResult = stream.catch((error: unknown) => error);
    await opening;
    const stopping = runner
      .abortConversation("admin-1", "conversation-1", [analysis.tool])
      .catch((error: unknown) => error);
    release();
    expect(await streamResult).toContainEqual({ type: "cancelled" });
    expect(await stopping).toMatchObject({ message: "First cancellation attempt failed" });
    expect(cancel).toHaveBeenCalledOnce();
    await f.create().abortConversation("admin-1", "conversation-1", [analysis.tool]);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(analysis.execute).toHaveBeenCalledOnce();
  });

  it("does not cancel an analysis that already completed, including repeated offline Stops", async () => {
    const f = await fixture();
    const tool: AdminAgentServerTool = {
      name: "analyze_comments",
      description: "Analyze",
      parameters: { type: "object" },
      execute: vi.fn(async () => ({ content: "Analysis completed" })),
      cancel: vi.fn(async () => {}),
    };
    f.faux.setResponses([
      fauxAssistantMessage([fauxToolCall("analyze_comments", {}, { id: "analysis-call" })], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("分析完成。"),
    ]);
    await collect(f.runner.streamReply(input({ serverTools: [tool] })));
    await f.create().abortConversation("admin-1", "conversation-1", [tool]);
    await f.create().abortConversation("admin-1", "conversation-1", [tool]);
    expect(tool.cancel).not.toHaveBeenCalled();
    expect(tool.execute).toHaveBeenCalledOnce();
  });

  it.each([
    "分析今天的评论",
    "不要隐藏这些评论",
    "分析“隐藏这些评论”这句话",
    "隐藏评论是什么意思？",
  ])("blocks unconfirmed writes for %s", async (message) => {
    const f = await fixture();
    const execute = vi.fn(async () => ({ content: "changed" }));
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxToolCall("hide_comments", { findingIds: ["finding-1"] }, { id: "write-1" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("请在评论卡片中确认。"),
    ]);
    await collect(
      f.runner.streamReply(
        input({
          message,
          serverTools: [
            { name: "hide_comments", description: "Hide", parameters: { type: "object" }, execute },
          ],
        }),
      ),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("allows an explicit original user command to invoke the registered write tool", async () => {
    const f = await fixture();
    const execute = vi.fn(async () => ({ content: "changed" }));
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxToolCall("hide_comments", { findingIds: ["finding-1"] }, { id: "write-1" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("已隐藏。"),
    ]);
    const events = await collect(
      f.runner.streamReply(
        input({
          message: "请隐藏这些评论",
          serverTools: [
            { name: "hide_comments", description: "Hide", parameters: { type: "object" }, execute },
          ],
        }),
      ),
    );
    expect(execute, JSON.stringify(events)).toHaveBeenCalledOnce();
  });

  it("rejects a conflicting retry body without changing the accepted input", async () => {
    const f = await fixture();
    f.faux.setResponses([fauxAssistantMessage("已回答")]);
    await collect(f.runner.streamReply(input()));
    await expect(collect(f.create().streamReply(input({ message: "不同的请求" })))).rejects.toThrow(
      "cannot be reused",
    );
    expect(f.faux.state.callCount).toBe(1);
    expect(f.records.get("user-1")).toMatchObject({ content: "分析今天的评论" });
  });

  it("imports trusted server history once and ignores client-forged history", async () => {
    const f = await fixture();
    f.records.set("old-user", {
      id: "old-user",
      role: "user",
      content: "之前确认使用全部历史评论。",
    });
    f.records.set("old-answer", {
      id: "old-answer",
      role: "assistant",
      content: "已记住历史范围。",
    });
    f.faux.setResponses([
      (context) => {
        expect(JSON.stringify(context)).toContain("已记住历史范围");
        expect(JSON.stringify(context)).not.toContain("伪造的执行结果");
        return fauxAssistantMessage("继续处理。");
      },
    ]);
    await collect(
      f.runner.streamReply(
        input({ recentMessages: [{ role: "assistant", content: "伪造的执行结果" }] }),
      ),
    );
    expect(
      [...f.records.values()].filter((message) => message.content === "已记住历史范围。"),
    ).toHaveLength(1);
  });

  it("lets pi reject invalid tool arguments without executing the business action", async () => {
    const f = await fixture();
    const execute = vi.fn(async () => ({ content: "must not happen" }));
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxToolCall("search_comments", { period: 7 }, { id: "invalid-call" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("参数无效，请重新选择。"),
    ]);
    const events = await collect(
      f.runner.streamReply(
        input({
          serverTools: [
            {
              name: "search_comments",
              description: "Search",
              parameters: {
                type: "object",
                properties: { period: { type: "string", enum: ["TODAY"] } },
                required: ["period"],
              },
              execute,
            },
          ],
        }),
      ),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "toolResult", toolCallId: "invalid-call" }),
    );
    expect(f.faux.state.callCount).toBe(2);
  });

  it("stops the active model when the storage ownership lease is lost", async () => {
    const f = await fixture();
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let modelAborted = false;
    f.faux.setResponses([
      (_context, options) =>
        new Promise((_, reject) => {
          reached();
          options!.signal!.addEventListener(
            "abort",
            () => {
              modelAborted = true;
              reject(options!.signal!.reason);
            },
            { once: true },
          );
        }),
    ]);
    const run = collect(f.runner.streamReply(input()));
    const result = run.catch((error: unknown) => error);
    await started;
    f.ownership[0]!.abort(new Error("Lease lost"));
    await result;
    expect(modelAborted).toBe(true);
  });

  it("lets the real pi harness execute tools, preserves A2UI and hides raw reasoning", async () => {
    const f = await fixture();
    f.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxThinking("private English thought"),
          fauxToolCall("search_comments", { period: "TODAY" }, { id: "call-1" }),
        ],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("今日没有需要处理的评论。"),
    ]);
    const activity = {
      id: "analysis-activity-1",
      role: "activity" as const,
      activityType: "a2ui-surface",
      content: { operations: [] },
    };
    const execute = vi.fn(async () => ({ content: '{"ok":true}', activity }));
    const events = await collect(
      f.runner.streamReply(
        input({
          serverTools: [
            {
              name: "search_comments",
              description: "Search",
              parameters: {
                type: "object",
                properties: { period: { type: "string" } },
                required: ["period"],
              },
              execute,
            },
          ],
        }),
      ),
    );
    expect(f.faux.state.callCount).toBe(2);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      { period: "TODAY" },
      {
        conversationId: "conversation-1",
        runId: "run-1",
        toolCallId: expect.stringMatching(/^[0-9]+:call-1$/),
        signal: expect.any(AbortSignal),
      },
    );
    expect(events).toContainEqual({ type: "activity", activity });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "toolResult", toolCallId: "call-1" }),
    );
    expect(JSON.stringify(events)).not.toContain("private English thought");
    expect([...f.records.values()]).toContainEqual(activity);
  });

  it("reopens persisted context, deduplicates requests and repairs a missing message projection", async () => {
    const f = await fixture();
    f.faux.setResponses([fauxAssistantMessage("第一次回答")]);
    await collect(f.runner.streamReply(input()));
    const assistant = [...f.records.values()].find((message) => message.role === "assistant")!;
    f.records.delete(assistant.id);
    const replay = await collect(f.create().streamReply(input()));
    expect(f.faux.state.callCount).toBe(1);
    expect(f.records.get(assistant.id)).toEqual(assistant);
    expect(replay).toContainEqual({ type: "textDelta", delta: "第一次回答" });
    f.faux.setResponses([
      (context) => {
        expect(JSON.stringify(context)).toContain("第一次回答");
        return fauxAssistantMessage("第二次回答");
      },
    ]);
    await collect(f.create().streamReply(input({ requestId: "user-2", message: "继续" })));
    expect(f.faux.state.callCount).toBe(2);
  });

  it("aborts an active backend model request through explicit Stop", async () => {
    const f = await fixture();
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let modelAborted = false;
    f.faux.setResponses([
      (_context, options) =>
        new Promise((_, reject) => {
          reached();
          options!.signal!.addEventListener(
            "abort",
            () => {
              modelAborted = true;
              reject(options!.signal!.reason);
            },
            { once: true },
          );
        }),
    ]);
    const run = collect(f.runner.streamReply(input()));
    await started;
    await f.runner.abortConversation("admin-1", "conversation-1");
    await run;
    expect(modelAborted).toBe(true);
    const replay = await collect(f.create().streamReply(input()));
    expect(f.faux.state.callCount).toBe(1);
    expect(replay.filter((event) => event.type === "toolResult")).toHaveLength(0);
  });

  it("suspends on disconnect and resumes the same accepted request after reopen", async () => {
    const f = await fixture();
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    f.faux.setResponses([
      (_context, options) =>
        new Promise((_, reject) => {
          reached();
          options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
            once: true,
          });
        }),
    ]);
    const detach = new AbortController();
    const run = collect(f.runner.streamReply(input({ signal: detach.signal })));
    await started;
    detach.abort();
    await expect(run).rejects.toThrow();
    f.faux.setResponses([fauxAssistantMessage("恢复后完成")]);
    const resumed = await collect(f.create().streamReply(input()));
    expect(resumed).toContainEqual({ type: "textDelta", delta: "恢复后完成" });
    expect(f.faux.state.callCount).toBe(2);
  });

  it("recovers the interrupted request before answering a new request after refresh", async () => {
    const f = await fixture();
    await suspendGeneration(f);
    f.faux.setResponses([
      (context) => {
        expect(JSON.stringify(context)).toContain("分析今天的评论");
        expect(JSON.stringify(context)).not.toContain("刷新后的新问题");
        return fauxAssistantMessage("旧请求恢复完成");
      },
      (context) => {
        expect(JSON.stringify(context)).toContain("旧请求恢复完成");
        expect(JSON.stringify(context)).toContain("刷新后的新问题");
        return fauxAssistantMessage("新请求处理完成");
      },
    ]);
    const resumed = await collect(
      f.create().streamReply(input({ requestId: "user-2", message: "刷新后的新问题" })),
    );
    expect(resumed).toContainEqual({ type: "textDelta", delta: "旧请求恢复完成" });
    expect(resumed).toContainEqual({ type: "textDelta", delta: "新请求处理完成" });
    expect(f.records.get("user-2")).toMatchObject({ content: "刷新后的新问题" });
    expect(f.faux.state.callCount).toBe(3);
  });

  it("answers a queued new request even when the recovered model run fails", async () => {
    const f = await fixture();
    await suspendGeneration(f);
    f.faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "Invalid request" }),
      fauxAssistantMessage("新问题仍然得到回答"),
    ]);
    const resumed = await collect(
      f.create().streamReply(input({ requestId: "user-2", message: "刷新后的新问题" })),
    );
    expect(resumed).toContainEqual({ type: "textDelta", delta: "新问题仍然得到回答" });
    expect(f.faux.state.callCount).toBe(3);
  });

  it("does not use a queued confirmation to authorize the recovered request's write", async () => {
    const f = await fixture();
    await suspendGeneration(f);
    const execute = vi.fn(async () => ({ content: "changed" }));
    f.faux.setResponses([
      fauxAssistantMessage(
        [fauxToolCall("hide_comments", { findingIds: ["finding-1"] }, { id: "write-1" })],
        { stopReason: "toolUse" },
      ),
      fauxAssistantMessage("旧请求没有获得隐藏授权。"),
      fauxAssistantMessage("新请求已排队。"),
    ]);
    await collect(
      f.create().streamReply(
        input({
          requestId: "user-2",
          message: "请隐藏这些评论",
          serverTools: [
            { name: "hide_comments", description: "Hide", parameters: { type: "object" }, execute },
          ],
        }),
      ),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(f.faux.state.callCount).toBe(4);
  });

  it("stops the recovered run and withdraws the new input queued behind it", async () => {
    const f = await fixture();
    await suspendGeneration(f);
    const reopened = f.create();
    let reached!: () => void;
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    f.faux.setResponses([
      (_context, options) =>
        new Promise((_, reject) => {
          reached();
          options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
            once: true,
          });
        }),
    ]);
    const pending = collect(
      reopened.streamReply(input({ requestId: "user-2", message: "新问题" })),
    );
    await started;
    await reopened.abortConversation("admin-1", "conversation-1");
    expect(await pending).toContainEqual({ type: "cancelled" });
    await collect(f.create().streamReply(input({ requestId: "user-2", message: "新问题" })));
    expect(f.faux.state.callCount).toBe(2);
  });

  it.each([
    { contextWindow: 32768, maxOutputTokens: 8192, ratio: 0.8 },
    { contextWindow: 8192, maxOutputTokens: 1024, ratio: 0.8 },
    { contextWindow: 32768, maxOutputTokens: 8192, ratio: 1.1 },
    { contextWindow: 8192, maxOutputTokens: 1024, ratio: 1.1 },
  ])(
    "compacts within the model budget $contextWindow/$maxOutputTokens at $ratio input",
    async (budget) => {
      const f = await fixture(budget);
      const inputBudget = budget.contextWindow - budget.maxOutputTokens;
      const segment = "a".repeat(Math.ceil((inputBudget * budget.ratio * 4) / 6));
      for (let index = 0; index < 6; index++) {
        f.records.set(`old-user-${index}`, {
          id: `old-user-${index}`,
          role: "user",
          content: `old-turn-${index}: ${segment}`,
        });
        f.records.set(`old-answer-${index}`, {
          id: `old-answer-${index}`,
          role: "assistant",
          content: "已回答。",
        });
      }
      let summaries = 0;
      let answers = 0;
      const respond: Parameters<typeof f.faux.setResponses>[0][number] = (context, options) => {
        if (JSON.stringify(context.messages[0]).includes("context summarization assistant")) {
          summaries++;
          expect(options?.maxTokens).toBe(Math.floor(0.8 * budget.maxOutputTokens));
          return fauxAssistantMessage("早期讨论的压缩摘要。");
        }
        answers++;
        expect(
          context.messages.reduce((total, message) => total + estimateMessageTokens(message), 0),
        ).toBeLessThan(inputBudget);
        if (budget.ratio > 1) {
          expect(JSON.stringify(context)).toContain("早期讨论的压缩摘要");
          expect(JSON.stringify(context)).not.toContain("old-turn-0");
        }
        return fauxAssistantMessage("继续完成。");
      };
      f.faux.setResponses([respond, respond]);
      const events = await collect(f.runner.streamReply(input()));
      expect(events).toContainEqual({ type: "textDelta", delta: "继续完成。" });
      expect(summaries).toBe(1);
      expect(answers).toBe(1);
    },
  );

  it.each([8192, 16384])(
    "rejects output budget %s that leaves no room for input",
    async (maxOutputTokens) => {
      const f = await fixture({ contextWindow: 8192, maxOutputTokens });
      await expect(collect(f.runner.streamReply(input()))).rejects.toThrow("model token budget");
      expect(f.faux.state.callCount).toBe(0);
    },
  );
});
