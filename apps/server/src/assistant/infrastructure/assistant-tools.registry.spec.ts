import { describe, expect, it, vi } from "vitest";
import { runToolCall } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import type { ListAdminOperationLogsUseCase } from "../../audit/application/list-admin-operation-logs.use-case";
import type { ListAdminArticleCommentsUseCase } from "../../comments/application/list-admin-article-comments.use-case";
import type { AssistantActionService } from "../application/assistant-action.service";
import {
  AssistantToolsRegistry,
  resolveAssistantCommentDateRange,
} from "./assistant-tools.registry";

const actor = { id: "admin-1", login: "Admin" };
const commentId = "d382041a-7275-4a6d-98a5-7e83afbb28f6";
const execution = {
  turnId: "turn-1",
  toolCallId: "turn-1:call_1",
  signal: new AbortController().signal,
};
function fixture() {
  const audit = {
    execute: vi.fn(async (_input?: unknown) => ({
      data: [
        {
          id: "log-1",
          actorLogin: "Admin",
          actorUserId: "private-user-id",
          action: "ARTICLE_UPDATED" as const,
          resourceType: "article",
          resourceId: "article-1",
          summary: "更新文章",
          metadata: { source: "private" },
          ipAddress: "private-ip",
          userAgent: "private-user-agent",
          createdAt: new Date("2026-11-06T00:00:00Z"),
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })),
  };
  const comments = {
    execute: vi.fn(async (_input?: unknown) => ({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    })),
  };
  const action = { prepare: vi.fn(async (_input?: unknown) => ({ id: "action-1" })) };
  const registry = new AssistantToolsRegistry(
    audit as unknown as ListAdminOperationLogsUseCase,
    comments as unknown as ListAdminArticleCommentsUseCase,
    action as unknown as AssistantActionService,
  );
  const tools = registry.create({
    actor,
    conversationId: "conversation-1",
    turnId: "turn-1",
    actionsEnabled: true,
  });
  return {
    registry,
    tools,
    audit,
    comments,
    action,
    tool: (name: string) => tools.find((tool) => tool.name === name)!,
  };
}

describe("AssistantToolsRegistry", () => {
  it.each([
    ["list_audit_logs", { action: "INVALID" }],
    ["list_audit_logs", { dateRange: { from: "2026-11-06", to: "2026-11-06" } }],
    ["list_audit_logs", { page: 0 }],
    ["list_audit_logs", { pageSize: 51 }],
    ["list_audit_logs", { actor: "forged" }],
    ["list_audit_logs", { actorLogin: " " }],
    ["search_comments", { commentId: "fake" }],
    ["search_comments", { status: "DELETED" }],
    ["search_comments", { actor: "forged" }],
    ["search_comments", { period: "INVALID" }],
    ["search_comments", { dateRange: { from: "2026-02-30", to: "2026-03-01" } }],
    ["search_comments", { period: "TODAY", dateRange: { from: "2026-11-06", to: "2026-11-06" } }],
    ["prepare_comment_moderation", { commentId, targetStatus: "DELETED" }],
    ["prepare_comment_moderation", { commentId, targetStatus: "HIDDEN", approved: true }],
  ] as const)(
    "rejects %s invalid parameters through the official Pi tool boundary: %j",
    async (name, args) => {
      const f = fixture();
      const tool = f.tool(name);
      const call = fauxToolCall(name, args);
      const outcome = await runToolCall(call, {
        tools: [
          {
            ...tool,
            execute: async (_id, input, signal) => ({
              content: [],
              details: await tool.execute(input, { ...execution, signal: signal! }),
            }),
          },
        ],
        assistantMessage: fauxAssistantMessage([call]),
        context: { messages: [], tools: [] },
        signal: execution.signal,
      });
      expect(outcome.isError).toBe(true);
      expect(f.audit.execute).not.toHaveBeenCalled();
      expect(f.comments.execute).not.toHaveBeenCalled();
      expect(f.action.prepare).not.toHaveBeenCalled();
    },
  );

  it("declares exact filters and explicit pagination semantics without changing supplied literals", async () => {
    const f = fixture();
    const audit = f.tool("list_audit_logs");
    const schema = audit.parameters as {
      properties: Record<string, { description?: string }>;
    };
    expect(audit.description).toContain("本轮不调用任何工具");
    expect(schema.properties.search?.description).toContain("逐字保留");
    expect(schema.properties.actorLogin?.description).toContain("逐字保留");
    expect(schema.properties.page?.description).toContain("默认1");
    expect(schema.properties.pageSize?.description).toContain("默认20");
    const search = "复查 Alpha-42 / 稳定性";
    const actorLogin = "MixedCase-Author";
    await audit.execute({ search, actorLogin }, execution);
    expect(f.audit.execute).toHaveBeenCalledWith(
      { page: 1, pageSize: 20, action: "ALL", search, actorLogin },
      { statementTimeoutMs: 5000 },
    );
    await f
      .tool("search_comments")
      .execute(
        { articleTitle: "项目 Beta：更新与回顾", author: actorLogin, content: search },
        execution,
      );
    expect(f.comments.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        articleTitle: "项目 Beta：更新与回顾",
        author: actorLogin,
        body: search,
        page: 1,
        pageSize: 20,
      }),
      { statementTimeoutMs: 5000 },
    );
  });

  it("only exposes safe audit fields and preserves default filters", async () => {
    const f = fixture();
    const result = await f.tool("list_audit_logs").execute({}, execution);
    expect(f.audit.execute).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 20,
        action: "ALL",
        actorLogin: undefined,
        search: undefined,
      },
      { statementTimeoutMs: 5000 },
    );
    expect(result).toMatchObject({
      kind: "audit_logs",
      ok: true,
      data: { data: [{ id: "log-1", summary: "更新文章" }], filters: { action: "ALL" } },
    });
    expect(JSON.stringify(result)).not.toMatch(/private|ipAddress|userAgent|metadata|actorUserId/);
  });

  it("combines comment filters and uses ALL when no time was requested", async () => {
    const f = fixture();
    await f.tool("search_comments").execute(
      {
        articleTitle: "文章",
        author: "作者",
        content: "正文",
        page: 2,
        pageSize: 10,
        status: "VISIBLE",
      },
      execution,
    );
    expect(f.comments.execute).toHaveBeenCalledOnce();
    expect(f.comments.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        articleTitle: "文章",
        author: "作者",
        body: "正文",
        page: 2,
        pageSize: 10,
        status: "VISIBLE",
      }),
      { statementTimeoutMs: 5000 },
    );
    expect(f.comments.execute.mock.calls[0]![0]).not.toHaveProperty("createdFrom");
    expect(f.comments.execute.mock.calls[0]![0]).not.toHaveProperty("createdTo");
  });

  it.each([
    { dateRange: { from: "2026-02-30", to: "2026-03-01" } },
    { dateRange: { from: "2026-11-07", to: "2026-11-06" } },
    { period: "TODAY", dateRange: { from: "2026-11-06", to: "2026-11-06" } },
  ])("rejects invalid comment boundaries: %j", async (args) => {
    const f = fixture();
    await expect(f.tool("search_comments").execute(args, execution)).rejects.toThrow();
    expect(f.comments.execute).not.toHaveBeenCalled();
  });

  it("resolves relative and inclusive absolute dates at Shanghai midnight, not UTC midnight", () => {
    const now = new Date("2026-11-05T18:00:00Z");
    expect(resolveAssistantCommentDateRange({ period: "TODAY" }, now)).toEqual({
      createdFrom: new Date("2026-11-05T16:00:00Z"),
      createdTo: new Date("2026-11-06T16:00:00Z"),
    });
    expect(resolveAssistantCommentDateRange({ period: "YESTERDAY" }, now)).toEqual({
      createdFrom: new Date("2026-11-04T16:00:00Z"),
      createdTo: new Date("2026-11-05T16:00:00Z"),
    });
    expect(resolveAssistantCommentDateRange({ period: "LAST_7_DAYS" }, now)).toEqual({
      createdFrom: new Date("2026-10-30T16:00:00Z"),
      createdTo: new Date("2026-11-06T16:00:00Z"),
    });
    expect(
      resolveAssistantCommentDateRange({ dateRange: { from: "2024-02-29", to: "2024-03-01" } }),
    ).toEqual({
      createdFrom: new Date("2024-02-28T16:00:00Z"),
      createdTo: new Date("2024-03-01T16:00:00Z"),
    });
  });

  it("prepares only an action preview with the server actor and stable tool identity", async () => {
    const f = fixture();
    await f
      .tool("prepare_comment_moderation")
      .execute({ commentId, targetStatus: "HIDDEN" }, execution);
    expect(f.action.prepare).toHaveBeenCalledWith({
      actor,
      conversationId: "conversation-1",
      turnId: "turn-1",
      toolCallId: "turn-1:call_1",
      commentId,
      targetStatus: "HIDDEN",
    });
    expect(f.action.prepare).toHaveBeenCalledOnce();
  });

  it("does not run a business query after cancellation", async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.tool("list_audit_logs").execute({}, { ...execution, signal: controller.signal }),
    ).rejects.toThrow();
    expect(f.audit.execute).not.toHaveBeenCalled();
  });
});
