import type { CreateAdminAgentWorkflowEventInput } from "./admin-agent.repository";
import type { AdminAgentParentRunRelation, AdminAgentWorkflowName } from "./admin-agent-run.entity";
import type { AdminAgentWorkflowTaskControlAction } from "./admin-agent-workflow-metadata";
import type { AdminAgentWorkflowNode } from "./admin-agent-workflow-node";
import { createAdminAgentWorkflowEventSummary } from "./admin-agent-workflow-summary";

type AdminAgentWorkflowRunCreatedEventInput = {
  dedupeKey?: string | null;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  parentRunId?: string | null;
  parentRunRelation?: AdminAgentParentRunRelation | null;
  runId: string;
  workflowName: AdminAgentWorkflowName;
};

type AdminAgentWorkflowRunAttemptEventInput = {
  attemptCount: number;
  resumed: boolean;
  runId: string;
  workflowName: AdminAgentWorkflowName;
};

type AdminAgentWorkflowControlledEventInput = {
  action: AdminAgentWorkflowTaskControlAction | "resume";
  resultRunId: string;
  resultStatus: string;
  runId: string;
  workflowName: AdminAgentWorkflowName;
};

type AdminAgentWorkflowNodeStartedEventInput = {
  node: AdminAgentWorkflowNode;
  payload?: Record<string, unknown> | null;
  runId: string;
  workflowName: AdminAgentWorkflowName;
};

type AdminAgentWorkflowInterruptedEventInput = {
  approvalNode: AdminAgentWorkflowNode;
  interruption: Record<string, unknown>;
  runId: string;
  summary: string;
};

type AdminAgentWorkflowCompletedEventInput = {
  runId: string;
  summary: string;
};

type AdminAgentWorkflowFailedEventInput = {
  errorMessage: string;
  runId: string;
};

type AdminAgentWorkflowCancelledEventInput = {
  runId: string;
  summary: string;
};

function createAdminAgentWorkflowRunCreatedEvent(
  input: AdminAgentWorkflowRunCreatedEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    payload: {
      dedupeKey: input.dedupeKey ?? null,
      input: input.input,
      metadata: input.metadata ?? null,
      parentRunId: input.parentRunId ?? null,
      parentRunRelation: input.parentRunRelation ?? null,
      workflowName: input.workflowName,
    },
    runId: input.runId,
    summary: createAdminAgentWorkflowEventSummary({
      eventType: "RUN_CREATED",
      workflowName: input.workflowName,
    }),
    type: "RUN_CREATED",
  };
}

function createAdminAgentWorkflowRunAttemptEvent(
  input: AdminAgentWorkflowRunAttemptEventInput,
): CreateAdminAgentWorkflowEventInput {
  const type = input.resumed ? "RUN_RESUMED" : "RUN_ATTEMPT_STARTED";

  return {
    payload: {
      attemptCount: input.attemptCount,
      resumed: input.resumed,
    },
    runId: input.runId,
    summary: createAdminAgentWorkflowEventSummary({
      attemptCount: input.attemptCount,
      eventType: type,
      workflowName: input.workflowName,
    }),
    type,
  };
}

function createAdminAgentWorkflowControlledEvent(
  input: AdminAgentWorkflowControlledEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    payload: {
      action: input.action,
      resultRunId: input.resultRunId,
      resultStatus: input.resultStatus,
    },
    runId: input.runId,
    summary: createAdminAgentWorkflowEventSummary({
      controlAction: input.action,
      eventType: "CONTROLLED",
      workflowName: input.workflowName,
    }),
    type: "CONTROLLED",
  };
}

function createAdminAgentWorkflowNodeStartedEvent(
  input: AdminAgentWorkflowNodeStartedEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    node: input.node,
    payload: input.payload ?? null,
    runId: input.runId,
    summary: createAdminAgentWorkflowEventSummary({
      eventType: "NODE_STARTED",
      node: input.node,
      workflowName: input.workflowName,
    }),
    type: "NODE_STARTED",
  };
}

function createAdminAgentWorkflowInterruptedEvent(
  input: AdminAgentWorkflowInterruptedEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    node: input.approvalNode,
    payload: {
      interruption: input.interruption,
    },
    runId: input.runId,
    summary: input.summary,
    type: "INTERRUPTED",
  };
}

function createAdminAgentWorkflowCompletedEvent(
  input: AdminAgentWorkflowCompletedEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    node: "completed",
    runId: input.runId,
    summary: input.summary,
    type: "COMPLETED",
  };
}

function createAdminAgentWorkflowFailedEvent(
  input: AdminAgentWorkflowFailedEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    node: "failed",
    payload: {
      errorMessage: input.errorMessage,
    },
    runId: input.runId,
    summary: input.errorMessage,
    type: "FAILED",
  };
}

function createAdminAgentWorkflowCancelledEvent(
  input: AdminAgentWorkflowCancelledEventInput,
): CreateAdminAgentWorkflowEventInput {
  return {
    node: "cancelled",
    payload: null,
    runId: input.runId,
    summary: input.summary,
    type: "CANCELLED",
  };
}

export {
  createAdminAgentWorkflowCancelledEvent,
  createAdminAgentWorkflowCompletedEvent,
  createAdminAgentWorkflowControlledEvent,
  createAdminAgentWorkflowFailedEvent,
  createAdminAgentWorkflowInterruptedEvent,
  createAdminAgentWorkflowNodeStartedEvent,
  createAdminAgentWorkflowRunAttemptEvent,
  createAdminAgentWorkflowRunCreatedEvent,
};
export type {
  AdminAgentWorkflowCancelledEventInput,
  AdminAgentWorkflowCompletedEventInput,
  AdminAgentWorkflowControlledEventInput,
  AdminAgentWorkflowFailedEventInput,
  AdminAgentWorkflowInterruptedEventInput,
  AdminAgentWorkflowNodeStartedEventInput,
  AdminAgentWorkflowRunAttemptEventInput,
  AdminAgentWorkflowRunCreatedEventInput,
};
