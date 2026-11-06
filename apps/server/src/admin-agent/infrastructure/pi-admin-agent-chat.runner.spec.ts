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
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";
import type {
  AdminAgentChatMessageRepository,
  AdminAgentMessage,
} from "../domain/admin-agent-chat-message.repository";
import type { AdminAgentChatReplyInput } from "../domain/admin-agent-chat-runner";
import { PiAdminAgentChatRunner } from "./pi-admin-agent-chat.runner";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "az-pi-chat-"));
  directories.push(directory);
  const faux = fauxProvider();
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
  const create = () =>
    new PiAdminAgentChatRunner(client, new ConfigService(), repository, { openStorage });
  return { runner: create(), create, faux, records, repository, ownership };
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

describe("PiAdminAgentChatRunner", () => {
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
});
