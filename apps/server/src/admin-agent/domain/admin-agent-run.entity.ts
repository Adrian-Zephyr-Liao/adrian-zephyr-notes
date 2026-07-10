type AdminAgentRunStatus =
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED"
  | "PENDING"
  | "RUNNING"
  | "WAITING_FOR_APPROVAL";

type AdminAgentRunType =
  | "ARTICLE_ASSISTANCE"
  | "AUDIT_REVIEW"
  | "COMMENT_MODERATION_TODAY"
  | "MULTI_TASK_ORCHESTRATION"
  | "SITE_CONFIG_REVIEW";
type AdminAgentWorkflowName =
  | "ARTICLE_ASSISTANCE"
  | "AUDIT_REVIEW"
  | "COMMENT_MODERATION_ANALYSIS"
  | "MULTI_TASK_ORCHESTRATION"
  | "SITE_CONFIG_REVIEW";
type AdminAgentWorkflowStartReason = "BRANCH" | "CHAT_INTENT" | "MANUAL" | "RETRY";
type AdminAgentParentRunRelation = "BRANCH" | "CHILD_TASK" | "RETRY";
const adminAgentWorkflowNames = [
  "ARTICLE_ASSISTANCE",
  "AUDIT_REVIEW",
  "COMMENT_MODERATION_ANALYSIS",
  "MULTI_TASK_ORCHESTRATION",
  "SITE_CONFIG_REVIEW",
] as const satisfies readonly AdminAgentWorkflowName[];

type AdminAgentRun = {
  id: string;
  type: AdminAgentRunType;
  workflowName: AdminAgentWorkflowName;
  threadId: string | null;
  parentRunId: string | null;
  parentRunRelation: AdminAgentParentRunRelation | null;
  dedupeKey: string | null;
  status: AdminAgentRunStatus;
  startedByUserId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  currentNode: string | null;
  interruption: Record<string, unknown> | null;
  attemptCount: number;
  summary: string | null;
  errorMessage: string | null;
  lastResumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export { adminAgentWorkflowNames };
export type {
  AdminAgentRun,
  AdminAgentParentRunRelation,
  AdminAgentRunStatus,
  AdminAgentRunType,
  AdminAgentWorkflowName,
  AdminAgentWorkflowStartReason,
};
