import type { AdminAgentCommentAnalysisScope } from "./admin-agent-comment-analysis";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";

type AdminAgentWorkflowApprovalOption = {
  id: string;
  label: string;
  description: string;
  resume: Record<string, unknown>;
};

type AdminAgentWorkflowApprovalSubject =
  | "ARTICLE"
  | "ARTICLE_COMMENT"
  | "AUDIT_LOG"
  | "MULTI_TASK"
  | "SITE_CONFIG";

type AdminAgentGenericApprovalInterruption = {
  kind: "ADMIN_AGENT_APPROVAL";
  action: string;
  approvalId: string;
  options: AdminAgentWorkflowApprovalOption[];
  payload: Record<string, unknown>;
  question: string;
  subject: AdminAgentWorkflowApprovalSubject;
  summary: string;
};

type AdminAgentGenericApprovalRequest = {
  action: string;
  payload: Record<string, unknown>;
  question: string;
  subject: AdminAgentWorkflowApprovalSubject;
  summary: string;
};

type AdminAgentCommentModerationApprovalInterruption = Omit<
  AdminAgentGenericApprovalInterruption,
  "action" | "kind" | "payload" | "subject"
> & {
  kind: "COMMENT_MODERATION_APPROVAL";
  action: "HIDE_COMMENT";
  findingIds: string[];
  payload: {
    findingIds: string[];
    scope: AdminAgentCommentAnalysisScope;
  };
  scope: AdminAgentCommentAnalysisScope;
  subject: "ARTICLE_COMMENT";
};

type AdminAgentWorkflowApprovalInterruption =
  | AdminAgentCommentModerationApprovalInterruption
  | AdminAgentGenericApprovalInterruption;

type CommentModerationApprovalResume = {
  actor?: AdminOperationActor;
  decision: "APPROVE" | "DEFER";
  findingIds: string[];
  requestContext?: AdminOperationRequestContext;
};

type GenericApprovalResume = {
  action?: string;
  actor?: AdminOperationActor;
  approvalId?: string;
  decision: string;
  payload?: Record<string, unknown>;
  requestContext?: AdminOperationRequestContext;
  subject?: AdminAgentWorkflowApprovalSubject;
};

type CreateGenericApprovalInterruptionInput = AdminAgentGenericApprovalRequest & {
  runId: string;
};

type CreateCommentModerationApprovalInterruptionInput = {
  findingIds: string[];
  runId: string;
  scope: AdminAgentCommentAnalysisScope;
};

function createGenericApprovalInterruption(
  input: CreateGenericApprovalInterruptionInput,
): AdminAgentGenericApprovalInterruption {
  const approvalId = `${input.action.toLowerCase()}:${input.runId}`;

  return {
    action: input.action,
    approvalId,
    kind: "ADMIN_AGENT_APPROVAL",
    options: [
      {
        description: "允许 Agent 继续执行该任务。",
        id: "approve",
        label: "确认继续",
        resume: {
          action: input.action,
          approvalId,
          decision: "approve",
          payload: input.payload,
          subject: input.subject,
        },
      },
      {
        description: "保留分析结果，但暂不继续执行。",
        id: "defer",
        label: "暂不继续",
        resume: {
          action: input.action,
          approvalId,
          decision: "defer",
          payload: input.payload,
          subject: input.subject,
        },
      },
    ],
    payload: input.payload,
    question: input.question,
    subject: input.subject,
    summary: input.summary,
  };
}

function createCommentModerationApprovalInterruption(
  input: CreateCommentModerationApprovalInterruptionInput,
): AdminAgentCommentModerationApprovalInterruption {
  const approvalId = `comment-moderation:${input.runId}`;

  return {
    action: "HIDE_COMMENT",
    approvalId,
    findingIds: input.findingIds,
    kind: "COMMENT_MODERATION_APPROVAL",
    options: [
      {
        description: "批量执行 Agent 生成的屏蔽建议。",
        id: "approve_all_hide",
        label: "确认屏蔽",
        resume: {
          decision: "APPROVE",
          findingIds: input.findingIds,
        },
      },
      {
        description: "保留建议但暂不执行写操作。",
        id: "defer",
        label: "暂不处理",
        resume: {
          decision: "DEFER",
          findingIds: input.findingIds,
        },
      },
    ],
    payload: {
      findingIds: input.findingIds,
      scope: input.scope,
    },
    question: `是否确认屏蔽 ${input.findingIds.length} 条评论？`,
    scope: input.scope,
    subject: "ARTICLE_COMMENT",
    summary: `确认后将屏蔽 ${input.findingIds.length} 条评论。`,
  };
}

function toCommentModerationApprovalResume(
  input: Record<string, unknown>,
): CommentModerationApprovalResume {
  const decision = input.decision;
  const findingIds = input.findingIds;

  if (decision !== "APPROVE" && decision !== "DEFER") {
    throw new Error("Comment moderation resume payload requires APPROVE or DEFER decision.");
  }

  if (!Array.isArray(findingIds) || !findingIds.every((item) => typeof item === "string")) {
    throw new Error("Comment moderation resume payload requires string findingIds.");
  }

  return {
    decision,
    findingIds,
  };
}

function toGenericApprovalResume(input: Record<string, unknown>): GenericApprovalResume {
  const decision = input.decision;

  if (typeof decision !== "string" || !decision.trim()) {
    throw new Error("Generic admin agent approval resume payload requires decision.");
  }

  return {
    action: normalizeOptionalStringInput(input.action),
    approvalId: normalizeOptionalStringInput(input.approvalId),
    decision: decision.trim(),
    payload: isPlainRecord(input.payload) ? input.payload : undefined,
    subject: isAdminAgentWorkflowApprovalSubject(input.subject) ? input.subject : undefined,
  };
}

function authorizeGenericApprovalResume(
  resume: GenericApprovalResume,
  interruption: AdminAgentGenericApprovalInterruption,
): GenericApprovalResume {
  if (resume.approvalId !== interruption.approvalId) {
    throw new Error("Generic admin agent approval resume approvalId does not match.");
  }

  if (resume.action !== interruption.action) {
    throw new Error("Generic admin agent approval resume action does not match.");
  }

  if (resume.subject !== interruption.subject) {
    throw new Error("Generic admin agent approval resume subject does not match.");
  }

  return {
    ...resume,
    action: interruption.action,
    approvalId: interruption.approvalId,
    payload: interruption.payload,
    subject: interruption.subject,
  };
}

function toCommentModerationApprovalInterruptionFromGraphResult(
  result: unknown,
): AdminAgentCommentModerationApprovalInterruption | null {
  return toCommentModerationApprovalInterruption(toFirstGraphInterruptValue(result));
}

function toGenericApprovalInterruptionFromGraphResult(
  result: unknown,
): AdminAgentGenericApprovalInterruption | null {
  return toGenericApprovalInterruption(toFirstGraphInterruptValue(result));
}

function toStoredCommentModerationApprovalInterruption(
  value: Record<string, unknown> | null,
): AdminAgentCommentModerationApprovalInterruption | null {
  return toCommentModerationApprovalInterruption(value);
}

function toStoredGenericApprovalInterruption(
  value: Record<string, unknown> | null,
): AdminAgentGenericApprovalInterruption | null {
  return toGenericApprovalInterruption(value);
}

function shouldRequestGenericApproval(input: Record<string, unknown>) {
  return (
    input.requiresApproval === true ||
    input.requireApproval === true ||
    input.approvalMode === "required"
  );
}

function isGenericApprovalApproved(approval: GenericApprovalResume) {
  return approval.decision === "approve" || approval.decision === "APPROVE";
}

function withGenericApprovalSummary(summary: string, approval: GenericApprovalResume | null) {
  if (!approval) {
    return summary;
  }

  return isGenericApprovalApproved(approval)
    ? `${summary}\n管理员已确认继续执行。`
    : `${summary}\n管理员选择暂不继续执行。`;
}

function toBusinessApprovalOutput(output: Record<string, unknown>): Record<string, unknown> {
  return sanitizeBusinessApprovalOutputRecord(output);
}

const hiddenBusinessApprovalOutputFields = new Set([
  "checkpointId",
  "checkpointNamespace",
  "currentNode",
  "langGraphRunId",
  "langgraphRunId",
  "node",
  "rawLangGraphState",
  "runId",
  "threadId",
  "workflow",
  "workflowCheckpoint",
  "workflowName",
  "workflowRevision",
  "workflowRunId",
]);

const hiddenBusinessApprovalOutputFieldPatterns = [
  /checkpoint/i,
  /lang[_-]?graph/i,
  /^node$/i,
  /^thread[_-]?id$/i,
  /workflow/i,
];

const hiddenBusinessApprovalOutputValuePatterns = [
  /agent[./_-]?runs/i,
  /checkpoint/i,
  /lang[_-]?graph/i,
  /runtime\s*panel/i,
  /thread[_-]?id/i,
  /workflow(?:Name|RunId)?/i,
  /运行面板/,
  /运行态/,
  /运行时/,
];

const omittedBusinessApprovalOutputValue = Symbol("omitted-business-approval-output-value");

function sanitizeBusinessApprovalOutputValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeBusinessApprovalOutputValue(item))
      .filter((item) => item !== omittedBusinessApprovalOutputValue);
  }

  if (typeof value === "string" && isHiddenBusinessApprovalOutputValue(value)) {
    return omittedBusinessApprovalOutputValue;
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  return sanitizeBusinessApprovalOutputRecord(value);
}

function sanitizeBusinessApprovalOutputRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isHiddenBusinessApprovalOutputField(key))
      .map(([key, item]) => [key, sanitizeBusinessApprovalOutputValue(item)] as const)
      .filter(([, item]) => item !== omittedBusinessApprovalOutputValue),
  );
}

function isHiddenBusinessApprovalOutputField(key: string) {
  return (
    hiddenBusinessApprovalOutputFields.has(key) ||
    hiddenBusinessApprovalOutputFieldPatterns.some((pattern) => pattern.test(key))
  );
}

function isHiddenBusinessApprovalOutputValue(value: string) {
  return hiddenBusinessApprovalOutputValuePatterns.some((pattern) => pattern.test(value));
}

function isAdminAgentWorkflowApprovalSubject(
  value: unknown,
): value is AdminAgentWorkflowApprovalSubject {
  return (
    value === "ARTICLE" ||
    value === "ARTICLE_COMMENT" ||
    value === "AUDIT_LOG" ||
    value === "MULTI_TASK" ||
    value === "SITE_CONFIG"
  );
}

function normalizeOptionalStringInput(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toFirstGraphInterruptValue(result: unknown) {
  if (!isPlainRecord(result) || !Array.isArray(result.__interrupt__)) {
    return null;
  }

  const [firstInterrupt] = result.__interrupt__;

  return isPlainRecord(firstInterrupt) ? firstInterrupt.value : null;
}

function toCommentModerationApprovalInterruption(
  value: unknown,
): AdminAgentCommentModerationApprovalInterruption | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (
    value.kind !== "COMMENT_MODERATION_APPROVAL" ||
    value.action !== "HIDE_COMMENT" ||
    value.subject !== "ARTICLE_COMMENT" ||
    typeof value.approvalId !== "string" ||
    !Array.isArray(value.findingIds) ||
    !value.findingIds.every((findingId) => typeof findingId === "string") ||
    !isPlainRecord(value.payload)
  ) {
    return null;
  }

  return value as AdminAgentCommentModerationApprovalInterruption;
}

function toGenericApprovalInterruption(
  value: unknown,
): AdminAgentGenericApprovalInterruption | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (
    value.kind !== "ADMIN_AGENT_APPROVAL" ||
    typeof value.action !== "string" ||
    typeof value.approvalId !== "string" ||
    !Array.isArray(value.options) ||
    !isPlainRecord(value.payload) ||
    typeof value.question !== "string" ||
    typeof value.summary !== "string" ||
    !isAdminAgentWorkflowApprovalSubject(value.subject)
  ) {
    return null;
  }

  return value as AdminAgentGenericApprovalInterruption;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  authorizeGenericApprovalResume,
  createCommentModerationApprovalInterruption,
  createGenericApprovalInterruption,
  isAdminAgentWorkflowApprovalSubject,
  isGenericApprovalApproved,
  shouldRequestGenericApproval,
  toCommentModerationApprovalInterruptionFromGraphResult,
  toCommentModerationApprovalResume,
  toBusinessApprovalOutput,
  toGenericApprovalResume,
  toGenericApprovalInterruptionFromGraphResult,
  toStoredCommentModerationApprovalInterruption,
  toStoredGenericApprovalInterruption,
  withGenericApprovalSummary,
};
export type {
  AdminAgentCommentModerationApprovalInterruption,
  AdminAgentGenericApprovalInterruption,
  AdminAgentGenericApprovalRequest,
  AdminAgentWorkflowApprovalInterruption,
  AdminAgentWorkflowApprovalOption,
  AdminAgentWorkflowApprovalSubject,
  CommentModerationApprovalResume,
  GenericApprovalResume,
};
