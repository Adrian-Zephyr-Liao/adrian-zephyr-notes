import type {
  AdminAgentWorkflowActionExecutionResult,
  ExecuteAdminAgentWorkflowActionInput,
} from "./admin-agent-workflow-action-executor";

type AdminAgentWorkflowActionExecutionStatus = "FAILED" | "RUNNING" | "SUCCEEDED";

type AdminAgentWorkflowActionExecution = {
  action: string;
  approvalId: string;
  createdAt: Date;
  errorMessage: string | null;
  id: string;
  payload: Record<string, unknown>;
  result: AdminAgentWorkflowActionExecutionResult | null;
  runId: string;
  status: AdminAgentWorkflowActionExecutionStatus;
  subject: ExecuteAdminAgentWorkflowActionInput["subject"];
  updatedAt: Date;
};

type AdminAgentWorkflowActionExecutionClaim = {
  claimStatus: "CLAIMED" | "IN_PROGRESS" | "SUCCEEDED";
  execution: AdminAgentWorkflowActionExecution;
};

type EnsureAdminAgentWorkflowActionExecutionInput = {
  action: string;
  approvalId: string;
  payload: Record<string, unknown>;
  runId: string;
  subject: ExecuteAdminAgentWorkflowActionInput["subject"];
};

const adminAgentWorkflowActionExecutionLeaseMs = 5 * 60 * 1000;

function isAdminAgentWorkflowActionExecutionInProgress(
  execution: Pick<
    AdminAgentWorkflowActionExecution,
    "errorMessage" | "result" | "status" | "updatedAt"
  >,
  now = new Date(),
) {
  if (execution.status !== "RUNNING" || execution.errorMessage || execution.result !== null) {
    return false;
  }

  return now.getTime() - execution.updatedAt.getTime() < adminAgentWorkflowActionExecutionLeaseMs;
}

function assertAdminAgentWorkflowActionExecutionMatchesInput(
  execution: Pick<
    AdminAgentWorkflowActionExecution,
    "action" | "approvalId" | "payload" | "subject"
  >,
  input: EnsureAdminAgentWorkflowActionExecutionInput,
) {
  if (
    execution.action === input.action &&
    execution.subject === input.subject &&
    areJsonObjectsEquivalent(execution.payload, input.payload)
  ) {
    return;
  }

  throw new Error(
    `Admin agent workflow action execution payload mismatch for approval: ${input.approvalId}`,
  );
}

function areJsonObjectsEquivalent(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(toCanonicalJsonValue(left)) === JSON.stringify(toCanonicalJsonValue(right));
}

function toCanonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalJsonValue(item));
  }

  if (!isPlainJsonObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => [key, toCanonicalJsonValue(item)]),
  );
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

class AdminAgentWorkflowActionExecutionInProgressError extends Error {
  constructor(readonly approvalId: string) {
    super(`Admin agent workflow action execution is already in progress: ${approvalId}`);
  }
}

export {
  AdminAgentWorkflowActionExecutionInProgressError,
  assertAdminAgentWorkflowActionExecutionMatchesInput,
  adminAgentWorkflowActionExecutionLeaseMs,
  isAdminAgentWorkflowActionExecutionInProgress,
};
export type {
  AdminAgentWorkflowActionExecution,
  AdminAgentWorkflowActionExecutionClaim,
  AdminAgentWorkflowActionExecutionStatus,
  EnsureAdminAgentWorkflowActionExecutionInput,
};
