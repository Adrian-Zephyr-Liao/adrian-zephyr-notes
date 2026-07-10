import { Prisma } from "@prisma/client";
import type {
  AdminAgentFinding,
  AdminAgentFindingTarget,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentCommentForAnalysis } from "../domain/admin-agent-comment-analysis";
import type { AdminAgentDecisionEffect } from "../domain/admin-agent-decision-effect.entity";
import type { AdminAgentWorkflowActionExecution } from "../domain/admin-agent-workflow-action-execution.entity";
import {
  adminAgentWorkflowNames,
  type AdminAgentRun,
  type AdminAgentRunType,
} from "../domain/admin-agent-run.entity";
import type { AdminAgentWorkflowEvent } from "../domain/admin-agent-workflow-event.entity";

const adminAgentFindingInclude = {
  run: true,
} satisfies Prisma.AdminAgentFindingInclude;

const agentCommentInclude = {
  article: {
    select: {
      id: true,
      slug: true,
      title: true,
    },
  },
  author: true,
  parentComment: {
    include: {
      author: true,
    },
  },
} satisfies Prisma.ArticleCommentInclude;

type AdminAgentRunRecord = Prisma.AdminAgentRunGetPayload<Record<string, never>>;
type AdminAgentWorkflowEventRecord = Prisma.AdminAgentWorkflowEventGetPayload<
  Record<string, never>
>;
type AdminAgentWorkflowActionExecutionRecord = Prisma.AdminAgentWorkflowActionExecutionGetPayload<
  Record<string, never>
>;
type AdminAgentDecisionEffectRecord = Prisma.AdminAgentDecisionEffectGetPayload<
  Record<string, never>
>;
type AdminAgentFindingRecord = Prisma.AdminAgentFindingGetPayload<{
  include: typeof adminAgentFindingInclude;
}>;
type AgentCommentRecord = Prisma.ArticleCommentGetPayload<{
  include: typeof agentCommentInclude;
}>;

function toAdminAgentRun(record: AdminAgentRunRecord): AdminAgentRun {
  return {
    attemptCount: record.attemptCount,
    createdAt: record.createdAt,
    currentNode: record.currentNode,
    dedupeKey: record.dedupeKey,
    errorMessage: record.errorMessage,
    id: record.id,
    interruption: toNullableInputRecord(record.interruption),
    input: toInputRecord(record.input),
    lastResumedAt: record.lastResumedAt,
    metadata: toNullableInputRecord(record.metadata),
    output: toNullableInputRecord(record.output),
    parentRunId: record.parentRunId,
    parentRunRelation: toAdminAgentParentRunRelation(record.parentRunRelation),
    startedByUserId: record.startedByUserId,
    status: record.status,
    summary: record.summary,
    threadId: record.threadId,
    type: toAdminAgentRunType(record.type),
    updatedAt: record.updatedAt,
    workflowName: toAdminAgentWorkflowName(record.workflowName),
  };
}

function toAdminAgentWorkflowEvent(record: AdminAgentWorkflowEventRecord): AdminAgentWorkflowEvent {
  return {
    createdAt: record.createdAt,
    id: record.id,
    node: record.node,
    payload: toNullableInputRecord(record.payload),
    runId: record.runId,
    summary: record.summary,
    type: record.type,
  };
}

function toAdminAgentWorkflowActionExecution(
  record: AdminAgentWorkflowActionExecutionRecord,
): AdminAgentWorkflowActionExecution {
  return {
    action: record.action,
    approvalId: record.approvalId,
    createdAt: record.createdAt,
    errorMessage: record.errorMessage,
    id: record.id,
    payload: toInputRecord(record.payload),
    result: toWorkflowActionExecutionResult(record.result),
    runId: record.runId,
    status: record.status,
    subject: toAdminAgentWorkflowApprovalSubject(record.subject),
    updatedAt: record.updatedAt,
  };
}

function toAdminAgentDecisionEffect(
  record: AdminAgentDecisionEffectRecord,
): AdminAgentDecisionEffect {
  return {
    attempts: record.attempts,
    createdAt: record.createdAt,
    effectKey: record.effectKey,
    errorMessage: record.errorMessage,
    findingId: record.findingId,
    id: record.id,
    payload: toInputRecord(record.payload),
    runId: record.runId,
    status: record.status,
    type: record.type,
    updatedAt: record.updatedAt,
  };
}

function toAdminAgentFinding(
  record: AdminAgentFindingRecord,
  target: AdminAgentFindingTarget | null,
): AdminAgentFinding {
  return {
    category: record.category,
    confidence: clampConfidence(record.confidence.toNumber()),
    createdAt: record.createdAt,
    evidence: toEvidence(record.evidence),
    executedAt: record.executedAt,
    id: record.id,
    proposedAction: record.proposedAction,
    reason: record.reason,
    runId: record.runId,
    severity: record.severity,
    status: record.status,
    target,
    targetId: record.targetId,
    targetType: record.targetType,
    updatedAt: record.updatedAt,
  };
}

function toAdminAgentCommentForAnalysis(record: AgentCommentRecord): AdminAgentCommentForAnalysis {
  return {
    article: record.article,
    author: {
      id: record.author.id,
      login: record.author.login,
      name: record.author.name,
    },
    body: record.body,
    createdAt: record.createdAt,
    id: record.id,
    parent: record.parentComment
      ? {
          authorLogin: record.parentComment.author.login,
          body: record.parentComment.body,
          id: record.parentComment.id,
        }
      : null,
    status: "VISIBLE",
  };
}

function toAdminAgentFindingTarget(record: AgentCommentRecord): AdminAgentFindingTarget {
  return {
    article: record.article,
    author: toTargetAuthor(record.author),
    body: record.body,
    createdAt: record.createdAt,
    id: record.id,
    parent: record.parentComment
      ? {
          author: toTargetAuthor(record.parentComment.author),
          body: record.parentComment.body,
          id: record.parentComment.id,
        }
      : null,
    status: record.status,
  };
}

function toTargetAuthor(record: AgentCommentRecord["author"]) {
  return {
    avatarUrl: record.avatarUrl,
    id: record.id,
    login: record.login,
    name: record.name,
    profileUrl: record.profileUrl,
  };
}

function toAdminAgentRunType(value: string): AdminAgentRunType {
  if (
    value === "ARTICLE_ASSISTANCE" ||
    value === "AUDIT_REVIEW" ||
    value === "COMMENT_MODERATION_TODAY" ||
    value === "MULTI_TASK_ORCHESTRATION" ||
    value === "SITE_CONFIG_REVIEW"
  ) {
    return value;
  }

  throw new Error(`Unsupported admin agent run type: ${value}`);
}

function toAdminAgentParentRunRelation(value: string | null): AdminAgentRun["parentRunRelation"] {
  if (value === "BRANCH" || value === "CHILD_TASK" || value === "RETRY") {
    return value;
  }

  return null;
}

function toAdminAgentWorkflowName(value: string): AdminAgentRun["workflowName"] {
  if (adminAgentWorkflowNames.some((workflowName) => workflowName === value)) {
    return value as AdminAgentRun["workflowName"];
  }

  throw new Error(`Unsupported admin agent workflow name: ${value}`);
}

function toAdminAgentWorkflowApprovalSubject(
  value: string,
): AdminAgentWorkflowActionExecution["subject"] {
  if (
    value === "ARTICLE" ||
    value === "ARTICLE_COMMENT" ||
    value === "AUDIT_LOG" ||
    value === "MULTI_TASK" ||
    value === "SITE_CONFIG"
  ) {
    return value;
  }

  throw new Error(`Unsupported admin agent workflow approval subject: ${value}`);
}

function toEvidence(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toInputRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toNullableInputRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  return toInputRecord(value);
}

function toWorkflowActionExecutionResult(
  value: Prisma.JsonValue | null,
): AdminAgentWorkflowActionExecution["result"] {
  if (value === null) {
    return null;
  }

  const record = toInputRecord(value);
  const appliedCount = record.appliedCount;
  const failedCount = record.failedCount;
  const results = record.results;

  if (
    typeof appliedCount !== "number" ||
    typeof failedCount !== "number" ||
    !Array.isArray(results)
  ) {
    throw new Error("Stored admin agent workflow action execution result is invalid.");
  }

  return {
    appliedCount,
    failedCount,
    results: results.map((item) => toWorkflowActionExecutionResultItem(item)),
  };
}

function toWorkflowActionExecutionResultItem(
  value: unknown,
): NonNullable<AdminAgentWorkflowActionExecution["result"]>["results"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored admin agent workflow action execution result item is invalid.");
  }

  const item = value as Record<string, unknown>;

  if (typeof item.resourceId !== "string") {
    throw new Error(
      "Stored admin agent workflow action execution result item is missing resourceId.",
    );
  }

  if (item.status === "APPLIED") {
    return {
      resourceId: item.resourceId,
      status: "APPLIED",
      summary: typeof item.summary === "string" ? item.summary : undefined,
    };
  }

  if (item.status === "FAILED") {
    const error = item.error;

    if (!error || typeof error !== "object" || Array.isArray(error)) {
      throw new Error("Stored admin agent workflow action execution failure is missing error.");
    }

    const failure = error as Record<string, unknown>;

    if (typeof failure.code !== "string" || typeof failure.message !== "string") {
      throw new Error("Stored admin agent workflow action execution failure error is invalid.");
    }

    return {
      error: {
        code: failure.code,
        message: failure.message,
      },
      resourceId: item.resourceId,
      status: "FAILED",
    };
  }

  throw new Error("Stored admin agent workflow action execution result item status is invalid.");
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

export {
  adminAgentFindingInclude,
  agentCommentInclude,
  toAdminAgentCommentForAnalysis,
  toAdminAgentDecisionEffect,
  toAdminAgentFinding,
  toAdminAgentFindingTarget,
  toAdminAgentRun,
  toAdminAgentWorkflowName,
  toAdminAgentWorkflowActionExecution,
  toAdminAgentWorkflowEvent,
};
export type {
  AdminAgentFindingRecord,
  AdminAgentWorkflowActionExecutionRecord,
  AdminAgentWorkflowEventRecord,
  AgentCommentRecord,
};
