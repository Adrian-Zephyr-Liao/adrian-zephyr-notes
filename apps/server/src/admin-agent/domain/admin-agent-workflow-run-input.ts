import type { CreateAdminAgentRunInput } from "./admin-agent.repository";
import type {
  AdminAgentParentRunRelation,
  AdminAgentRun,
  AdminAgentWorkflowStartReason,
} from "./admin-agent-run.entity";
import type { StartAdminAgentWorkflowRunnerInput } from "./admin-agent-workflow-runner";
import { getAdminAgentWorkflowMetadata } from "./admin-agent-workflow-metadata";

type CreateAdminAgentWorkflowRunInputOptions = {
  now?: Date;
  runId: string;
};

type CreateAdminAgentWorkflowBranchRunInput = {
  sourceRun: AdminAgentRun;
  sourceThreadId: string;
  startedByUserId: string | null;
};

function createAdminAgentWorkflowRunInput(
  input: StartAdminAgentWorkflowRunnerInput,
  options: CreateAdminAgentWorkflowRunInputOptions,
): CreateAdminAgentRunInput {
  const metadata = getAdminAgentWorkflowMetadata(input.workflowName);
  const startReason = input.startReason ?? "MANUAL";
  const workflowInput = input.input ?? null;

  return {
    dedupeKey: input.dedupeKey ?? null,
    id: options.runId,
    input: {
      requestedAt: toIsoString(options.now),
      startReason,
      workflowInput,
    },
    metadata: {
      graph: metadata.graphName,
      requestedAt: toIsoString(options.now),
      startReason,
    },
    parentRunId: input.parentRunId ?? null,
    parentRunRelation: toParentRunRelation(input.parentRunId ?? null, startReason),
    startedByUserId: input.startedByUserId,
    threadId: options.runId,
    type: metadata.runType,
    workflowName: metadata.workflowName,
  };
}

function createAdminAgentWorkflowBranchRunInput(
  input: CreateAdminAgentWorkflowBranchRunInput,
  options: CreateAdminAgentWorkflowRunInputOptions,
): CreateAdminAgentRunInput {
  return {
    dedupeKey: null,
    id: options.runId,
    input: {
      ...input.sourceRun.input,
      branchedFromRunId: input.sourceRun.id,
      branchedFromThreadId: input.sourceThreadId,
    },
    metadata: {
      ...input.sourceRun.metadata,
      branchedAt: toIsoString(options.now),
      branchedFromRunId: input.sourceRun.id,
      branchedFromThreadId: input.sourceThreadId,
      graphBranch: true,
      startReason: "BRANCH",
    },
    parentRunId: input.sourceRun.id,
    parentRunRelation: "BRANCH",
    startedByUserId: input.startedByUserId,
    threadId: options.runId,
    type: input.sourceRun.type,
    workflowName: input.sourceRun.workflowName,
  };
}

function toAdminAgentWorkflowRetryInput(sourceRun: AdminAgentRun): Record<string, unknown> | null {
  if (!("workflowInput" in sourceRun.input)) {
    return null;
  }

  const workflowInput = sourceRun.input.workflowInput;

  return isPlainRecord(workflowInput) ? workflowInput : null;
}

function toIsoString(now?: Date) {
  return (now ?? new Date()).toISOString();
}

function toParentRunRelation(
  parentRunId: string | null,
  startReason: AdminAgentWorkflowStartReason,
): AdminAgentParentRunRelation | null {
  if (!parentRunId) {
    return null;
  }

  if (startReason === "BRANCH" || startReason === "RETRY") {
    return startReason;
  }

  return "CHILD_TASK";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  createAdminAgentWorkflowBranchRunInput,
  createAdminAgentWorkflowRunInput,
  toAdminAgentWorkflowRetryInput,
};
export type { CreateAdminAgentWorkflowBranchRunInput, CreateAdminAgentWorkflowRunInputOptions };
