import { adminAgentA2uiCatalogId } from "@adrian-zephyr-notes/contracts";
import { assembleOps, validateA2UIComponents } from "@ag-ui/a2ui-toolkit";
import type { AdminAgentMessage } from "../domain/admin-agent-chat-message.repository";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";

type CreateCommentAnalysisActivityInput = {
  analysisId: string;
  analyzedCount: number;
  findings: AdminAgentFinding[];
  scope: unknown;
  summary: string;
};

function createCommentAnalysisActivityMessage(
  input: CreateCommentAnalysisActivityInput,
): Extract<AdminAgentMessage, { role: "activity" }> {
  const data = toCommentAnalysisData(input);
  const components = createCommentAnalysisComponents(data);
  const validation = validateA2UIComponents({ components });

  if (!validation.valid) {
    throw new Error(
      `Comment analysis A2UI validation failed: ${validation.errors.map((error) => error.message).join("; ")}`,
    );
  }

  return {
    activityType: "a2ui-surface",
    content: {
      a2ui_operations: assembleOps({
        catalogId: adminAgentA2uiCatalogId,
        components,
        intent: "create",
        surfaceId: toCommentAnalysisSurfaceId(input.analysisId),
      }),
    },
    id: toCommentAnalysisActivityMessageId(input.analysisId),
    role: "activity",
  };
}

function createCommentAnalysisComponents(
  data: ReturnType<typeof toCommentAnalysisData>,
): Array<Record<string, unknown>> {
  return [
    {
      children: ["comment-analysis-review"],
      component: "Column",
      id: "root",
    },
    {
      ...data,
      component: "CommentAnalysisReview",
      id: "comment-analysis-review",
    },
  ];
}

function toCommentAnalysisData(input: CreateCommentAnalysisActivityInput) {
  const actionableCount = input.findings.filter(isFindingActionable).length;
  const hiddenCount = input.findings.filter(isFindingHidden).length;

  return {
    analysisId: input.analysisId,
    analyzedCount: input.analyzedCount,
    counts: {
      actionable: actionableCount,
      high: input.findings.filter((finding) => finding.severity === "HIGH").length,
      low: input.findings.filter((finding) => finding.severity === "LOW").length,
      medium: input.findings.filter((finding) => finding.severity === "MEDIUM").length,
    },
    findings: input.findings.map((finding) => ({
      articleSlug: finding.target?.article.slug ?? "",
      articleTitle: finding.target?.article.title ?? "未知文章",
      authorLogin: finding.target?.author.login ?? "未知用户",
      category: finding.category,
      commentId: finding.targetId,
      commentStatus: finding.target?.status ?? "HIDDEN",
      confidence: finding.confidence,
      createdAt: finding.target?.createdAt.toISOString() ?? finding.createdAt.toISOString(),
      evidence: finding.evidence,
      excerpt: toExcerpt(finding.target?.body ?? "评论已不存在"),
      findingId: finding.id,
      proposedAction: finding.proposedAction,
      reason: finding.reason,
      severity: finding.severity,
      status: finding.status,
    })),
    scope: toScopeLabel(input.scope),
    summary: appendGovernanceStatus(input.summary, hiddenCount, actionableCount),
  };
}

function appendGovernanceStatus(summary: string, hiddenCount: number, actionableCount: number) {
  if (hiddenCount === 0) {
    return summary;
  }

  return `${summary} 当前已隐藏 ${hiddenCount} 条，${actionableCount} 条仍待处理。`;
}

function isFindingActionable(finding: AdminAgentFinding) {
  return (
    finding.proposedAction === "HIDE_COMMENT" &&
    finding.target?.status === "VISIBLE" &&
    ["FAILED", "PENDING", "REJECTED", "RESTORED"].includes(finding.status)
  );
}

function isFindingHidden(finding: AdminAgentFinding) {
  return finding.target?.status === "HIDDEN" || finding.status === "EXECUTED";
}

function toCommentAnalysisActivityMessageId(analysisId: string) {
  return `comment-analysis-activity-${analysisId}`;
}

function toCommentAnalysisSurfaceId(analysisId: string) {
  return `comment-analysis-${analysisId}`;
}

function toExcerpt(value: string, limit = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function toScopeLabel(value: unknown) {
  if (value === "today") {
    return "今日可见评论";
  }

  if (value === "recentVisibleFallback") {
    return "最近可见评论";
  }

  return "已选评论";
}

export {
  createCommentAnalysisActivityMessage,
  isFindingActionable,
  toCommentAnalysisActivityMessageId,
  toCommentAnalysisData,
};
