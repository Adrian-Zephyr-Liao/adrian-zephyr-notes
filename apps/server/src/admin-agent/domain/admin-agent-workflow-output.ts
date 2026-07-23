import type { AdminAgentCommentAnalysisScope } from "./admin-agent-comment-analysis";
import type { AdminAgentFinding } from "./admin-agent-finding.entity";
import type { AdminAgentRun } from "./admin-agent-run.entity";
import type { AdminAgentWorkflowActionExecutionResult } from "./admin-agent-workflow-action-executor";
import type {
  AdminAgentWorkflowApprovalInterruption,
  CommentModerationApprovalResume,
} from "./admin-agent-workflow-approval";
import type { AdminAgentWorkflowResult } from "./admin-agent-workflow-runner";

type AdminAgentCommentModerationWorkflowOutput = {
  actionResult: AdminAgentWorkflowActionExecutionResult | null;
  analyzedCount: number;
  findingCount: number;
  findingIds: string[];
  scope: AdminAgentCommentAnalysisScope;
};
type AdminAgentGenericWorkflowRawResult = {
  output?: unknown;
  summary?: string;
};
type AdminAgentCommentModerationApprovalUpdateInput = {
  actionResult: AdminAgentWorkflowActionExecutionResult | null;
  approval: CommentModerationApprovalResume | null;
  findingCount?: number;
  summary?: string | null;
};
type AdminAgentCommentModerationApprovalUpdate = {
  actionResult: AdminAgentWorkflowActionExecutionResult | null;
  summary: string;
};
type AdminAgentCommentModerationCompletionInput = {
  actionResult: AdminAgentWorkflowActionExecutionResult | null;
  analyzedCount?: number;
  findings: AdminAgentFinding[];
  scope: AdminAgentCommentAnalysisScope;
  summary?: string | null;
};
type AdminAgentCommentModerationCompletionResult = {
  output: AdminAgentCommentModerationWorkflowOutput;
  summary: string;
};
type AdminAgentCommentModerationWorkflowRawResult = {
  actionResult?: AdminAgentWorkflowActionExecutionResult | null;
  comments?: unknown[];
  findings?: AdminAgentFinding[];
  scope?: unknown;
  summary?: string;
};
type AdminAgentCommentModerationWorkflowResult = AdminAgentWorkflowResult & {
  findings: AdminAgentFinding[];
  output: AdminAgentCommentModerationWorkflowOutput;
  scope: AdminAgentCommentAnalysisScope;
  summary: string;
};
type AdminAgentGenericApprovalInterruption = Extract<
  AdminAgentWorkflowApprovalInterruption,
  { kind: "ADMIN_AGENT_APPROVAL" }
>;

function toAdminAgentWorkflowFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 2000);
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 2000);
  }

  return "Admin agent workflow failed with an unknown error.";
}

function toAdminAgentWorkflowOutputRecord(value: unknown): Record<string, unknown> {
  return isPlainWorkflowOutputRecord(value) ? value : {};
}

function toCommentModerationWorkflowOutput(
  findings: AdminAgentFinding[],
  scope: AdminAgentCommentAnalysisScope,
  actionResult: AdminAgentWorkflowActionExecutionResult | null = null,
  analyzedCount = 0,
): AdminAgentCommentModerationWorkflowOutput {
  return {
    actionResult,
    analyzedCount,
    findingCount: findings.length,
    findingIds: findings.map((finding) => finding.id),
    scope,
  };
}

function toCommentModerationScope(value: unknown): AdminAgentCommentAnalysisScope {
  if (value === "selection" || value === "today") {
    return value;
  }

  return "recentVisibleFallback";
}

function toCommentModerationWorkflowResult(input: {
  interruption: AdminAgentWorkflowApprovalInterruption | null;
  result: AdminAgentCommentModerationWorkflowRawResult;
  run: AdminAgentRun;
  summaryFallback?: string;
}): AdminAgentCommentModerationWorkflowResult {
  const findings = Array.isArray(input.result.findings) ? input.result.findings : [];
  const scope = toCommentModerationScope(input.result.scope);

  return {
    findings,
    interruption: input.interruption,
    output: toCommentModerationWorkflowOutput(
      findings,
      scope,
      input.result.actionResult ?? null,
      input.result.comments?.length ?? 0,
    ),
    run: input.run,
    scope,
    summary: input.result.summary || input.run.summary || input.summaryFallback || "",
  };
}

function createCommentModerationApprovalUpdate(
  input: AdminAgentCommentModerationApprovalUpdateInput,
): AdminAgentCommentModerationApprovalUpdate {
  const baseSummary = input.summary || "评论治理建议已生成。";

  if (!input.approval && input.findingCount === 0) {
    return {
      actionResult: null,
      summary: input.summary || "",
    };
  }

  if (!input.approval || input.approval.decision === "DEFER") {
    return {
      actionResult: null,
      summary: `${baseSummary}\n管理员选择暂不执行写操作，任务已结束。`,
    };
  }

  if (!input.actionResult || input.actionResult.results.length === 0) {
    return {
      actionResult: input.actionResult,
      summary: `${baseSummary}\n管理员已确认写操作，但当前没有可执行的待处理屏蔽建议。`,
    };
  }

  return {
    actionResult: input.actionResult,
    summary: `${baseSummary}\n管理员已确认 ${input.actionResult.results.length} 条评论治理建议；已执行 ${input.actionResult.appliedCount} 条，失败 ${input.actionResult.failedCount} 条。`,
  };
}

function createCommentModerationCompletionResult(
  input: AdminAgentCommentModerationCompletionInput,
): AdminAgentCommentModerationCompletionResult {
  return {
    output: toCommentModerationWorkflowOutput(
      input.findings,
      input.scope,
      input.actionResult,
      input.analyzedCount,
    ),
    summary:
      input.summary ||
      (input.findings.length > 0
        ? `评论治理任务已生成 ${input.findings.length} 条建议。`
        : "评论治理任务已完成，未生成建议。"),
  };
}

function toGenericApprovalWorkflowCompletedResult(
  result: AdminAgentGenericWorkflowRawResult,
  run: AdminAgentRun,
): AdminAgentWorkflowResult {
  return {
    interruption: null,
    output: toAdminAgentWorkflowOutputRecord(result.output),
    run,
    summary: result.summary || run.summary || "",
  };
}

function toGenericApprovalWorkflowInterruptedResult(
  result: AdminAgentGenericWorkflowRawResult,
  run: AdminAgentRun,
  interruption: AdminAgentGenericApprovalInterruption,
): AdminAgentWorkflowResult {
  return {
    interruption,
    output: toAdminAgentWorkflowOutputRecord(result.output),
    run,
    summary: result.summary || run.summary || interruption.summary,
  };
}

function withGenericApprovalActionSummary(
  summary: string,
  actionResult: AdminAgentWorkflowActionExecutionResult | null,
) {
  if (!actionResult) {
    return summary;
  }

  return `${summary}\n已执行审批写操作：成功 ${actionResult.appliedCount} 项，失败 ${actionResult.failedCount} 项。`;
}

function isReadOnlyGenericApprovalAction(action: string | undefined) {
  return !action || action.startsWith("REVIEW_") || action === "APPROVE_MULTI_TASK_PLAN";
}

function isPlainWorkflowOutputRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  createCommentModerationApprovalUpdate,
  createCommentModerationCompletionResult,
  isReadOnlyGenericApprovalAction,
  toAdminAgentWorkflowFailureMessage,
  toAdminAgentWorkflowOutputRecord,
  toCommentModerationScope,
  toCommentModerationWorkflowResult,
  toCommentModerationWorkflowOutput,
  toGenericApprovalWorkflowCompletedResult,
  toGenericApprovalWorkflowInterruptedResult,
  withGenericApprovalActionSummary,
};
export type {
  AdminAgentCommentModerationApprovalUpdate,
  AdminAgentCommentModerationApprovalUpdateInput,
  AdminAgentCommentModerationCompletionInput,
  AdminAgentCommentModerationCompletionResult,
  AdminAgentCommentModerationWorkflowRawResult,
  AdminAgentCommentModerationWorkflowOutput,
  AdminAgentCommentModerationWorkflowResult,
  AdminAgentGenericWorkflowRawResult,
};
