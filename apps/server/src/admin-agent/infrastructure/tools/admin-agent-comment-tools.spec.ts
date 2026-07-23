import { adminAgentA2uiCatalogId } from "@adrian-zephyr-notes/contracts";
import { describe, expect, it, vi } from "vitest";
import type { AdminAgentFinding } from "../../domain/admin-agent-finding.entity";
import type { AdminAgentServerToolExecutionContext } from "../../domain/admin-agent-chat-runner";
import { AdminAgentCommentTools } from "./admin-agent-comment-tools";

const executionContext: AdminAgentServerToolExecutionContext = {
  conversationId: "conversation-1",
  runId: "agent-run-1",
  toolCallId: "tool-call-1",
};

describe("AdminAgentCommentTools", () => {
  it("translates article, author, date, and sort constraints into one bounded comment search", async () => {
    const listComments = {
      execute: vi.fn().mockResolvedValue({
        data: [createComment()],
        pagination: {
          page: 1,
          pageSize: 50,
          totalItems: 2,
          totalPages: 1,
        },
      }),
    };
    const search = getTool(createTools({ listComments }), "search_comments");
    const toolResult = await search.execute(
      {
        articleTitle: " 测试文章 ",
        author: " reader ",
        dateRange: { from: "2026-07-20", to: "2026-07-22" },
        limit: 99,
        sort: "OLDEST",
        status: "VISIBLE",
      },
      executionContext,
    );
    const result = JSON.parse(toolResult.content) as {
      ok: boolean;
      result: {
        comments: Array<{ excerpt: string; id: string }>;
        matchedCount: number;
        truncated: boolean;
      };
    };

    expect(listComments.execute).toHaveBeenCalledWith({
      articleId: undefined,
      articleSlug: undefined,
      articleTitle: "测试文章",
      author: "reader",
      body: undefined,
      createdFrom: new Date(2026, 6, 20),
      createdTo: new Date(2026, 6, 23),
      page: 1,
      pageSize: 50,
      search: undefined,
      sort: "OLDEST",
      status: "VISIBLE",
    });
    expect(result).toMatchObject({
      ok: true,
      result: {
        comments: [{ id: "comment-1" }],
        matchedCount: 2,
        truncated: true,
      },
    });
    expect(result.result.comments[0]?.excerpt.length).toBeLessThanOrEqual(240);
  });

  it("does not invent a date restriction when only an article title is provided", async () => {
    const listComments = {
      execute: vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        },
      }),
    };
    const search = getTool(createTools({ listComments }), "search_comments");

    await search.execute({ articleTitle: "Markdown 语法全量展示" }, executionContext);

    expect(listComments.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        articleTitle: "Markdown 语法全量展示",
        createdFrom: undefined,
        createdTo: undefined,
      }),
    );
  });

  it("analyzes a deduplicated selection and returns a durable activity outside tool content", async () => {
    const startWorkflow = vi.fn().mockResolvedValue({
      interruption: null,
      output: {
        analyzedCount: 2,
        findingCount: 1,
        findingIds: ["finding-1"],
        scope: "selection",
      },
      run: {
        id: "run-1",
      },
      summary: "识别出 1 条高风险评论。",
    });
    const listFindingsByIds = vi.fn().mockResolvedValue([createFinding()]);
    const analyze = getTool(createTools({ listFindingsByIds, startWorkflow }), "analyze_comments");
    const result = await analyze.execute(
      {
        commentIds: ["comment-1", "comment-1", "comment-2"],
        objective: "MODERATION_RISK",
      },
      executionContext,
    );
    const content = JSON.parse(result.content) as {
      result: { analysisId: string; findingIds: string[] };
    };
    const serializedActivity = JSON.stringify(result.activity);

    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          commentIds: ["comment-1", "comment-2"],
          objective: "MODERATION_RISK",
        },
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    );
    expect(listFindingsByIds).toHaveBeenCalledWith(["finding-1"]);
    expect(content.result).toEqual({
      analysisId: "run-1",
      analyzedCount: 2,
      findingIds: ["finding-1"],
      suggestedHideFindingIds: ["finding-1"],
      summary: "识别出 1 条高风险评论。",
    });
    expect(result.activity).toMatchObject({
      activityType: "a2ui-surface",
      id: "comment-analysis-activity-run-1",
      role: "activity",
    });
    expect(serializedActivity).toContain(adminAgentA2uiCatalogId);
    expect(serializedActivity).toContain("CommentAnalysisReview");
    expect(serializedActivity).toContain('"findingId":"finding-1"');
    expect(result.content).not.toContain("a2ui_operations");
  });

  it("hides reviewed findings as one atomic tool call and returns the replaced activity", async () => {
    const moderateCommentAnalysis = {
      execute: vi.fn().mockResolvedValue({
        analysis: {
          id: "analysis-1",
          output: { analyzedCount: 1, scope: "selection" },
          summary: "识别出 1 条高风险评论。",
        },
        findings: [createFinding({ status: "EXECUTED", targetStatus: "HIDDEN" })],
        result: {
          results: [{ findingId: "finding-1", status: "APPLIED" }],
        },
      }),
    };
    const hide = getTool(createTools({ moderateCommentAnalysis }), "hide_comments");
    const toolResult = await hide.execute(
      {
        analysisId: "analysis-1",
        findingIds: ["finding-1", "finding-1", "  "],
      },
      executionContext,
    );
    const result = JSON.parse(toolResult.content);

    expect(moderateCommentAnalysis.execute).toHaveBeenCalledWith({
      action: "HIDE",
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      analysisId: "analysis-1",
      findingIds: ["finding-1"],
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    });
    expect(result).toEqual({
      ok: true,
      result: {
        action: "HIDE",
        analysisId: "analysis-1",
        appliedCount: 1,
        failedCount: 0,
        results: [{ findingId: "finding-1", status: "APPLIED" }],
      },
    });
    expect(toolResult.activity).toMatchObject({
      id: "comment-analysis-activity-analysis-1",
      role: "activity",
    });
    expect(JSON.stringify(toolResult.activity)).toContain('"commentStatus":"HIDDEN"');
  });

  it("rejects an empty analysis selection before starting a workflow", async () => {
    const startWorkflow = vi.fn();
    const analyze = getTool(createTools({ startWorkflow }), "analyze_comments");

    await expect(analyze.execute({ commentIds: ["", "  "] }, executionContext)).rejects.toThrow(
      "at least one valid comment ID",
    );
    expect(startWorkflow).not.toHaveBeenCalled();
  });
});

function createTools(
  overrides: {
    listComments?: { execute: ReturnType<typeof vi.fn> };
    listFindingsByIds?: ReturnType<typeof vi.fn>;
    moderateCommentAnalysis?: { execute: ReturnType<typeof vi.fn> };
    startWorkflow?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const commentTools = new AdminAgentCommentTools(
    (overrides.listComments ?? { execute: vi.fn() }) as never,
    { startWorkflow: overrides.startWorkflow ?? vi.fn() } as never,
    (overrides.moderateCommentAnalysis ?? { execute: vi.fn() }) as never,
    {
      listFindingsByIds: overrides.listFindingsByIds ?? vi.fn().mockResolvedValue([]),
    } as never,
  );

  return commentTools.create({
    actor: {
      id: "admin-1",
      login: "adrian",
    },
    requestContext: {
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    },
    startedByUserId: "admin-1",
  });
}

function getTool(
  tools: ReturnType<AdminAgentCommentTools["create"]>,
  name: "analyze_comments" | "hide_comments" | "restore_comments" | "search_comments",
) {
  const tool = tools.find((candidate) => candidate.name === name);

  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }

  return tool;
}

function createComment() {
  return {
    article: {
      id: "article-1",
      slug: "post-1",
      title: "测试文章",
    },
    author: {
      avatarUrl: null,
      id: "user-1",
      login: "reader",
      name: null,
      profileUrl: "https://github.com/reader",
    },
    body: "这是一条用于验证摘要长度的评论。".repeat(30),
    createdAt: new Date("2026-07-22T00:00:00.000Z"),
    id: "comment-1",
    likeCount: 2,
    parent: null,
    parentCommentId: null,
    replyCount: 1,
    status: "VISIBLE" as const,
    updatedAt: new Date("2026-07-22T00:00:00.000Z"),
  };
}

function createFinding(
  overrides: {
    status?: AdminAgentFinding["status"];
    targetStatus?: "HIDDEN" | "VISIBLE";
  } = {},
): AdminAgentFinding {
  const createdAt = new Date("2026-07-22T00:00:00.000Z");

  return {
    category: "ABUSE",
    confidence: 0.96,
    createdAt,
    evidence: ["明显辱骂"],
    executedAt: overrides.status === "EXECUTED" ? createdAt : null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "评论包含明确的人身攻击。",
    runId: "run-1",
    severity: "HIGH",
    status: overrides.status ?? "PENDING",
    target: {
      ...createComment(),
      parent: null,
      status: overrides.targetStatus ?? "VISIBLE",
    },
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: createdAt,
  };
}
