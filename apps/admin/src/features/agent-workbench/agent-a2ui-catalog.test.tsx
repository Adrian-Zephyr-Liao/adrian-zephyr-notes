// @vitest-environment jsdom

import type { AdminAgentActivityMessageResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentAnalysisReview } from "./agent-a2ui-catalog";

const mocks = vi.hoisted(() => ({
  hideAdminAgentCommentAnalysisFindings: vi.fn(),
}));

vi.mock("../../lib/admin-api", () => ({
  hideAdminAgentCommentAnalysisFindings: mocks.hideAdminAgentCommentAnalysisFindings,
}));

vi.mock("@copilotkit/a2ui-renderer", () => ({
  createCatalog: vi.fn(() => ({})),
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: vi.fn(),
  useCopilotKit: vi.fn(),
}));

describe("CommentAnalysisReview", () => {
  beforeEach(() => {
    mocks.hideAdminAgentCommentAnalysisFindings.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts with actionable comments and keeps all results reachable through filters and pages", () => {
    const findings = [
      createFinding(),
      ...Array.from({ length: 9 }, (_, index) =>
        createFinding({
          excerpt: `低风险评论 ${index + 1}`,
          findingId: `finding-low-${index + 1}`,
          proposedAction: "NO_ACTION",
          reason: `低风险判断 ${index + 1}`,
          severity: "LOW",
        }),
      ),
    ];

    renderReview(findings);

    expect(screen.getByText("你是不是脑残")).not.toBeNull();
    expect(screen.queryByText("低风险评论 1")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "全部10" }));
    expect(screen.getByText("低风险评论 7")).not.toBeNull();
    expect(screen.queryByText("低风险评论 8")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("低风险评论 8")).not.toBeNull();
    expect(screen.getByText("低风险评论 9")).not.toBeNull();
    expect(screen.queryByText("你是不是脑残")).toBeNull();

    fireEvent.click(screen.getByText("低风险评论 8"));
    expect(screen.getByText("低风险判断 8")).not.toBeNull();
  });

  it("hides selected findings in one request and replaces the analysis activity", async () => {
    const activityMessage = createActivityMessage();
    const onActivityUpdated = vi.fn();
    mocks.hideAdminAgentCommentAnalysisFindings.mockResolvedValue({
      activityMessage,
      analysisId: "analysis-1",
      appliedCount: 2,
      failedCount: 0,
      results: [
        { findingId: "finding-1", status: "APPLIED" },
        { findingId: "finding-2", status: "APPLIED" },
      ],
    });

    renderReview(
      [
        createFinding(),
        createFinding({ excerpt: "第二条风险评论", findingId: "finding-2", severity: "MEDIUM" }),
      ],
      onActivityUpdated,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择评论：你是不是脑残" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择评论：第二条风险评论" }));
    expect(screen.getByText("已选 2 条")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "隐藏选中评论" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(screen.getByText("隐藏选中的 2 条评论？")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "统一隐藏" }));

    await waitFor(() => {
      expect(screen.getByText("已统一隐藏 2 条评论，分析结果已更新。")).not.toBeNull();
    });
    expect(mocks.hideAdminAgentCommentAnalysisFindings).toHaveBeenCalledTimes(1);
    expect(mocks.hideAdminAgentCommentAnalysisFindings).toHaveBeenCalledWith(
      "conversation-1",
      "analysis-1",
      {
        findingIds: ["finding-1", "finding-2"],
      },
    );
    expect(onActivityUpdated).toHaveBeenCalledWith(activityMessage);
  });

  it("keeps selected findings available when the batch request fails", async () => {
    mocks.hideAdminAgentCommentAnalysisFindings.mockRejectedValue(new Error("评论批量隐藏失败。"));

    renderReview([createFinding()]);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择评论：你是不是脑残" }));
    fireEvent.click(screen.getByRole("button", { name: "隐藏选中评论" }));
    fireEvent.click(screen.getByRole("button", { name: "统一隐藏" }));

    expect((await screen.findByRole("alert")).textContent).toContain("评论批量隐藏失败。");
    expect(screen.getByText("已选 1 条")).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "隐藏选中评论" }).disabled).toBe(
      false,
    );
  });
});

function renderReview(findings: ReturnType<typeof createFinding>[], onActivityUpdated = vi.fn()) {
  return render(
    <CommentAnalysisReview
      conversationId="conversation-1"
      props={createAnalysisProps(findings)}
      onActivityUpdated={onActivityUpdated}
    />,
  );
}

function createAnalysisProps(findings: ReturnType<typeof createFinding>[]) {
  return {
    analysisId: "analysis-1",
    analyzedCount: findings.length,
    counts: {
      actionable: findings.filter((finding) => finding.proposedAction === "HIDE_COMMENT").length,
      high: findings.filter((finding) => finding.severity === "HIGH").length,
      low: findings.filter((finding) => finding.severity === "LOW").length,
      medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
    },
    findings,
    scope: "已选评论",
    summary: "评论风险分析完成。",
  };
}

function createFinding(
  overrides: Partial<{
    excerpt: string;
    findingId: string;
    proposedAction: "HIDE_COMMENT" | "NO_ACTION";
    reason: string;
    severity: "HIGH" | "LOW" | "MEDIUM";
  }> = {},
) {
  return {
    articleSlug: "test-article",
    articleTitle: "测试文章",
    authorLogin: "reader",
    category: "ABUSE" as const,
    commentId: `comment-${overrides.findingId ?? "1"}`,
    commentStatus: "VISIBLE" as const,
    confidence: 0.96,
    createdAt: "2026-07-22T00:00:00.000Z",
    evidence: ["明显辱骂"],
    excerpt: overrides.excerpt ?? "你是不是脑残",
    findingId: overrides.findingId ?? "finding-1",
    proposedAction: overrides.proposedAction ?? ("HIDE_COMMENT" as const),
    reason: overrides.reason ?? "评论包含明确的人身攻击。",
    severity: overrides.severity ?? ("HIGH" as const),
    status: "PENDING" as const,
  };
}

function createActivityMessage(): AdminAgentActivityMessageResponse {
  return {
    activityType: "a2ui-surface",
    content: {
      a2ui_operations: [],
    },
    id: "comment-analysis-activity-analysis-1",
    role: "activity",
  };
}
