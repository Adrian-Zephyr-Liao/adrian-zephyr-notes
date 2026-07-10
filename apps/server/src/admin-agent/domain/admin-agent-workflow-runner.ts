import type {
  AdminAgentRun,
  AdminAgentWorkflowName,
  AdminAgentWorkflowStartReason,
} from "./admin-agent-run.entity";
import type {
  AdminAgentWorkflowApprovalInterruption,
  AdminAgentWorkflowApprovalOption,
  AdminAgentWorkflowApprovalSubject,
} from "./admin-agent-workflow-approval";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";

type StartAdminAgentWorkflowRunnerInput = {
  dedupeKey?: string | null;
  input?: Record<string, unknown> | null;
  parentRunId?: string | null;
  startReason?: AdminAgentWorkflowStartReason;
  startedByUserId: string | null;
  workflowName: AdminAgentWorkflowName;
};

type BranchAdminAgentWorkflowRunnerInput = {
  parentRunId: string;
  sourceThreadId: string;
  startedByUserId: string | null;
  workflowName: AdminAgentWorkflowName;
};

type ResumeAdminAgentWorkflowRunnerInput = {
  actor: AdminOperationActor;
  requestContext?: AdminOperationRequestContext;
  resume: Record<string, unknown>;
  threadId: string;
  workflowName: AdminAgentWorkflowName;
};

type RefreshAdminAgentWorkflowRunnerInput = {
  runId: string;
  startedByUserId: string | null;
  workflowName: AdminAgentWorkflowName;
};

type AdminAgentWorkflowResult = {
  interruption: AdminAgentWorkflowApprovalInterruption | null;
  output: Record<string, unknown>;
  run: AdminAgentRun;
  summary: string;
};

interface AdminAgentWorkflowRunner {
  branchWorkflow(input: BranchAdminAgentWorkflowRunnerInput): Promise<AdminAgentWorkflowResult>;
  refreshWorkflow(input: RefreshAdminAgentWorkflowRunnerInput): Promise<AdminAgentWorkflowResult>;
  resumeWorkflow(input: ResumeAdminAgentWorkflowRunnerInput): Promise<AdminAgentWorkflowResult>;
  startWorkflow(input: StartAdminAgentWorkflowRunnerInput): Promise<AdminAgentWorkflowResult>;
}

class AdminAgentWorkflowExecutionError extends Error {
  constructor(
    readonly runId: string,
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
  }
}

class AdminAgentWorkflowInvalidResumeError extends Error {
  constructor(
    readonly workflowName: AdminAgentWorkflowName,
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
  }
}

const ADMIN_AGENT_WORKFLOW_RUNNER = Symbol("ADMIN_AGENT_WORKFLOW_RUNNER");

export {
  ADMIN_AGENT_WORKFLOW_RUNNER,
  AdminAgentWorkflowExecutionError,
  AdminAgentWorkflowInvalidResumeError,
};
export type {
  AdminAgentWorkflowApprovalInterruption,
  AdminAgentWorkflowApprovalOption,
  AdminAgentWorkflowApprovalSubject,
  AdminAgentWorkflowResult,
  AdminAgentWorkflowRunner,
  BranchAdminAgentWorkflowRunnerInput,
  RefreshAdminAgentWorkflowRunnerInput,
  ResumeAdminAgentWorkflowRunnerInput,
  StartAdminAgentWorkflowRunnerInput,
};
