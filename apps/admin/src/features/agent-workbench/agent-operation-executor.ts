import type {
  AdminAgentActionExecutionResultResponse,
  AdminAgentFindingResponse,
  ResumeAdminAgentTaskResponse,
} from "@adrian-zephyr-notes/contracts";
import { resumeAdminAgentTask } from "../../lib/admin-api";
import type {
  AgentTaskResumeChoiceOperation,
  AskUserChoiceOperation,
} from "./agent-human-in-loop-contracts";
import { agentTaskResumeChoiceOperationSchema } from "./agent-human-in-loop-contracts";

type AgentOperationAction = "hide" | "ignore" | "restore" | "resume";

type ConfirmedOperationResult = {
  appliedAction?: AgentOperationAction;
  error?: string;
  findingId: string;
  reason?: string;
  requestedAction: AgentOperationAction;
  skipped?: boolean;
  status?: AdminAgentFindingResponse["status"];
  targetStatus?: NonNullable<AdminAgentFindingResponse["target"]>["status"];
  taskStatus?: ResumeAdminAgentTaskResponse["task"]["status"];
};

async function executeAgentOperations(operations: AskUserChoiceOperation[]) {
  return executeAgentTaskResumeOperations(operations.filter(isAgentTaskResumeOperation));
}

async function executeAgentTaskResumeOperations(operations: AgentTaskResumeChoiceOperation[]) {
  const results: ConfirmedOperationResult[] = [];

  for (const operation of operations) {
    const decision = toAgentTaskResumeDecision(operation.resume);
    const findingIds = toAgentTaskResumeFindingIds(operation.resume);
    const requestedAction = toAgentTaskResumeRequestedAction(decision, findingIds);
    const response = await resumeAdminAgentTask(operation.taskId, {
      resume: operation.resume,
    });
    const actionResult = toActionExecutionResult(response.output?.actionResult);

    if (actionResult) {
      results.push(
        ...toConfirmedResultsFromActionResult(
          actionResult,
          requestedAction,
          response.task.status,
          response.task.id,
        ),
      );
      continue;
    }

    if (findingIds.length === 0) {
      results.push({
        appliedAction: requestedAction,
        findingId: response.task.id,
        requestedAction,
        taskStatus: response.task.status,
      });
      continue;
    }

    for (const findingId of findingIds) {
      results.push({
        appliedAction: requestedAction,
        findingId,
        requestedAction,
        taskStatus: response.task.status,
      });
    }
  }

  return results;
}

function isAgentTaskResumeOperation(
  operation: unknown,
): operation is AgentTaskResumeChoiceOperation {
  return agentTaskResumeChoiceOperationSchema.safeParse(operation).success;
}

function toAgentTaskResumeDecision(resume: Record<string, unknown>) {
  return resume.decision === "APPROVE" ? "APPROVE" : "DEFER";
}

function toAgentTaskResumeFindingIds(resume: Record<string, unknown>) {
  return Array.isArray(resume.findingIds)
    ? resume.findingIds.filter((findingId): findingId is string => typeof findingId === "string")
    : [];
}

function toAgentTaskResumeRequestedAction(
  decision: ReturnType<typeof toAgentTaskResumeDecision>,
  findingIds: string[],
): AgentOperationAction {
  if (findingIds.length === 0) {
    return "resume";
  }

  return decision === "APPROVE" ? "hide" : "ignore";
}

function toActionExecutionResult(value: unknown): AdminAgentActionExecutionResultResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<AdminAgentActionExecutionResultResponse>;

  if (
    typeof record.appliedCount !== "number" ||
    typeof record.failedCount !== "number" ||
    !Array.isArray(record.results)
  ) {
    return null;
  }

  const results = record.results.flatMap((result) => {
    const parsed = toActionExecutionResultItem(result);
    return parsed ? [parsed] : [];
  });

  return {
    appliedCount: record.appliedCount,
    failedCount: record.failedCount,
    results,
  };
}

function toActionExecutionResultItem(
  value: unknown,
): AdminAgentActionExecutionResultResponse["results"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<AdminAgentActionExecutionResultResponse["results"][number]>;

  if (typeof record.resourceId !== "string") {
    return null;
  }

  if (record.status === "APPLIED") {
    return {
      resourceId: record.resourceId,
      status: "APPLIED",
      summary: typeof record.summary === "string" ? record.summary : undefined,
    };
  }

  if (
    record.status === "FAILED" &&
    record.error &&
    typeof record.error === "object" &&
    !Array.isArray(record.error)
  ) {
    const error = record.error as Partial<{ code: string; message: string }>;

    return {
      error: {
        code: typeof error.code === "string" ? error.code : "ACTION_FAILED",
        message: typeof error.message === "string" ? error.message : "操作执行失败。",
      },
      resourceId: record.resourceId,
      status: "FAILED",
    };
  }

  return null;
}

function toConfirmedResultsFromActionResult(
  actionResult: AdminAgentActionExecutionResultResponse,
  requestedAction: AgentOperationAction,
  taskStatus: ResumeAdminAgentTaskResponse["task"]["status"],
  fallbackResourceId: string,
): ConfirmedOperationResult[] {
  if (actionResult.results.length === 0) {
    return [
      {
        findingId: fallbackResourceId,
        reason: "没有可执行的写操作。",
        requestedAction,
        skipped: true,
        taskStatus,
      },
    ];
  }

  return actionResult.results.map((result) => {
    if (result.status === "FAILED") {
      return {
        error: result.error.message,
        findingId: result.resourceId,
        requestedAction,
        taskStatus,
      };
    }

    const confirmedResult: ConfirmedOperationResult = {
      appliedAction: requestedAction,
      findingId: result.resourceId,
      requestedAction,
      taskStatus,
    };

    if (result.summary) {
      confirmedResult.reason = result.summary;
    }

    return confirmedResult;
  });
}

export { executeAgentOperations, isAgentTaskResumeOperation };
export type { AgentOperationAction, ConfirmedOperationResult };
