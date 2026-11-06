import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import type { AdminAgentWorkflowApprovalSubject } from "./admin-agent-workflow-approval";

type AdminAgentWorkflowActionKey = `${AdminAgentWorkflowApprovalSubject}.${string}`;

type ExecuteAdminAgentWorkflowActionInput = {
  action: string;
  actor: AdminOperationActor;
  payload: Record<string, unknown>;
  requestContext?: AdminOperationRequestContext;
  subject: AdminAgentWorkflowApprovalSubject;
};

type AdminAgentWorkflowActionExecutionResult = {
  appliedCount: number;
  failedCount: number;
  results: Array<
    | {
        resourceId: string;
        summary?: string;
        status: "APPLIED";
      }
    | {
        error: {
          code: string;
          message: string;
        };
        resourceId: string;
        status: "FAILED";
      }
  >;
};

interface AdminAgentWorkflowActionHandler {
  readonly actionKey: AdminAgentWorkflowActionKey;
  execute(
    input: ExecuteAdminAgentWorkflowActionInput,
  ): Promise<AdminAgentWorkflowActionExecutionResult>;
}

interface AdminAgentWorkflowActionExecutor {
  executeAction(
    input: ExecuteAdminAgentWorkflowActionInput,
  ): Promise<AdminAgentWorkflowActionExecutionResult>;
  executeActionWithReceipt?(
    input: ExecuteAdminAgentWorkflowActionInput,
    executionId: string,
  ): Promise<AdminAgentWorkflowActionExecutionResult | null>;
}

interface AdminAgentAtomicActionExecutor {
  execute(
    input: ExecuteAdminAgentWorkflowActionInput,
    executionId: string,
  ): Promise<AdminAgentWorkflowActionExecutionResult | null>;
}

class AdminAgentWorkflowActionUnsupportedError extends Error {
  constructor(
    readonly action: string,
    readonly subject: string,
  ) {
    super(`Unsupported admin agent workflow action: ${subject}.${action}`);
  }
}

class AdminAgentWorkflowActionValidationError extends Error {}

const ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR = Symbol("ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR");
const ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS = Symbol("ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS");
const ADMIN_AGENT_ATOMIC_ACTION_EXECUTOR = Symbol("ADMIN_AGENT_ATOMIC_ACTION_EXECUTOR");

export {
  ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR,
  ADMIN_AGENT_ATOMIC_ACTION_EXECUTOR,
  ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS,
  AdminAgentWorkflowActionUnsupportedError,
  AdminAgentWorkflowActionValidationError,
};
export type {
  AdminAgentWorkflowActionHandler,
  AdminAgentWorkflowActionKey,
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
  AdminAgentAtomicActionExecutor,
  ExecuteAdminAgentWorkflowActionInput,
};
