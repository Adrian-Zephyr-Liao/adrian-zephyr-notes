import { describe, expect, it } from "vitest";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import {
  createHomeFindingWhere,
  createRecentActionWhere,
  createTodayExecutedActionWhere,
  filterHomeFindings,
  toRecentAction,
} from "./prisma-admin-agent-home.repository";

describe("PrismaAdminAgentHomeRepository helpers", () => {
  it("keeps executed action metrics scoped to real comment status updates", () => {
    expect(
      createTodayExecutedActionWhere({
        recentActionLimit: 5,
        todayEnd: new Date("2026-07-05T00:00:00.000Z"),
        todayStart: new Date("2026-07-04T00:00:00.000Z"),
      }),
    ).toEqual({
      action: "COMMENT_STATUS_UPDATED",
      createdAt: {
        gte: new Date("2026-07-04T00:00:00.000Z"),
        lt: new Date("2026-07-05T00:00:00.000Z"),
      },
    });
  });

  it("includes agent decisions and execution results in recent actions", () => {
    expect(createRecentActionWhere()).toEqual({
      action: {
        in: [
          "ADMIN_AGENT_FINDING_CREATED",
          "ADMIN_AGENT_FINDING_DECIDED",
          "COMMENT_STATUS_UPDATED",
        ],
      },
    });
  });

  it("loads pending findings and executed hide-comment findings as home candidates", () => {
    expect(createHomeFindingWhere()).toEqual({
      OR: [
        {
          status: "PENDING",
        },
        {
          proposedAction: "HIDE_COMMENT",
          status: "EXECUTED",
          targetType: "ARTICLE_COMMENT",
        },
      ],
    });
  });

  it("keeps restorable executed hidden findings visible after refresh", () => {
    expect(
      filterHomeFindings([
        createFinding({ id: "pending", status: "PENDING", target: null }),
        createFinding({
          id: "restorable",
          status: "EXECUTED",
          target: createFindingTarget({ status: "HIDDEN" }),
        }),
        createFinding({
          id: "already-visible",
          status: "EXECUTED",
          target: createFindingTarget({ status: "VISIBLE" }),
        }),
        createFinding({
          id: "restored",
          status: "RESTORED",
          target: createFindingTarget({ status: "VISIBLE" }),
        }),
      ]).map((finding) => finding.id),
    ).toEqual(["pending", "restorable"]);
  });

  it("preserves recent action types when mapping records", () => {
    expect(
      [
        toRecentAction(
          createActionRecord({
            action: "ADMIN_AGENT_FINDING_CREATED",
            metadata: {
              findingCount: 2,
            },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "ADMIN_AGENT_FINDING_DECIDED",
            metadata: {
              decision: "EXECUTE_PROPOSED_ACTION",
            },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "COMMENT_STATUS_UPDATED",
            metadata: {
              source: "admin_agent",
              status: "HIDDEN",
            },
          }),
        ),
      ].map((action) => action.action),
    ).toEqual([
      "ADMIN_AGENT_FINDING_CREATED",
      "ADMIN_AGENT_FINDING_DECIDED",
      "COMMENT_STATUS_UPDATED",
    ]);
  });

  it("formats agent generated-finding summaries for the home activity feed", () => {
    expect(
      toRecentAction(
        createActionRecord({
          action: "ADMIN_AGENT_FINDING_CREATED",
          metadata: { findingCount: 2 },
          summary: "Agent generated findings.",
        }),
      ).summary,
    ).toBe("Agent 已生成 2 条风险建议，等待人工确认。");
  });

  it("formats agent decision summaries for the home activity feed", () => {
    expect(
      [
        toRecentAction(
          createActionRecord({
            action: "ADMIN_AGENT_FINDING_DECIDED",
            metadata: { decision: "EXECUTE_PROPOSED_ACTION" },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "ADMIN_AGENT_FINDING_DECIDED",
            metadata: { decision: "REJECT" },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "ADMIN_AGENT_FINDING_DECIDED",
            metadata: { decision: "RESTORE_COMMENT" },
          }),
        ),
      ].map((action) => action.summary),
    ).toEqual([
      "管理员已批准 Agent 建议，执行屏蔽评论。",
      "管理员已忽略一条 Agent 风险建议。",
      "管理员已确认 Agent 误判并恢复评论。",
    ]);
  });

  it("formats only agent-driven comment status summaries", () => {
    expect(
      [
        toRecentAction(
          createActionRecord({
            action: "COMMENT_STATUS_UPDATED",
            metadata: { source: "admin_agent", status: "HIDDEN" },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "COMMENT_STATUS_UPDATED",
            metadata: { source: "admin_agent", status: "VISIBLE" },
          }),
        ),
        toRecentAction(
          createActionRecord({
            action: "COMMENT_STATUS_UPDATED",
            metadata: { status: "HIDDEN" },
            summary: "Updated article comment status to HIDDEN",
          }),
        ),
      ].map((action) => action.summary),
    ).toEqual([
      "Agent 工作台已隐藏评论。",
      "Agent 工作台已恢复评论可见。",
      "Updated article comment status to HIDDEN",
    ]);
  });
});

function createActionRecord(overrides: Partial<Parameters<typeof toRecentAction>[0]> = {}) {
  return {
    action: "COMMENT_STATUS_UPDATED",
    actorLogin: "adrian",
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    id: "audit-1",
    metadata: null,
    resourceId: "comment-1",
    resourceType: "article_comment",
    summary: "Comment status updated.",
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "ABUSE",
    confidence: 0.91,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
    evidence: ["攻击性表达"],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "评论含有人身攻击。",
    runId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: createFindingTarget(),
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-04T03:00:00.000Z"),
    ...overrides,
  };
}

function createFindingTarget(
  overrides: Partial<NonNullable<AdminAgentFinding["target"]>> = {},
): NonNullable<AdminAgentFinding["target"]> {
  return {
    article: {
      id: "article-1",
      slug: "article",
      title: "Article",
    },
    author: {
      avatarUrl: null,
      id: "user-1",
      login: "reader",
      name: "Reader",
      profileUrl: "https://github.com/reader",
    },
    body: "comment",
    createdAt: new Date("2026-07-04T02:00:00.000Z"),
    id: "comment-1",
    parent: null,
    status: "VISIBLE",
    ...overrides,
  };
}
