import type {
  AdminAgentRunType,
  AdminAgentWorkflowName,
  AdminAgentWorkflowStartReason,
} from "./admin-agent-run.entity";
import type { AdminAgentWorkflowResult } from "./admin-agent-workflow-runner";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";

type StartAdminAgentWorkflowInput = {
  input?: Record<string, unknown> | null;
  parentRunId?: string | null;
  startedByUserId: string | null;
  startReason?: AdminAgentWorkflowStartReason;
};

type StartAdminAgentWorkflowResult = AdminAgentWorkflowResult;

type ResumeAdminAgentWorkflowInput = {
  actor: AdminOperationActor;
  requestContext?: AdminOperationRequestContext;
  resume: Record<string, unknown>;
  threadId: string;
};

type ResumeAdminAgentWorkflowResult = StartAdminAgentWorkflowResult;
type RefreshAdminAgentWorkflowInput = {
  runId: string;
  startedByUserId: string | null;
};
type RefreshAdminAgentWorkflowResult = StartAdminAgentWorkflowResult;
type BranchAdminAgentWorkflowInput = {
  parentRunId: string;
  sourceThreadId: string;
  startedByUserId: string | null;
};
type BranchAdminAgentWorkflowResult = StartAdminAgentWorkflowResult;

type AdminAgentWorkflowDefinition = {
  branch: (input: BranchAdminAgentWorkflowInput) => Promise<BranchAdminAgentWorkflowResult>;
  refresh: (input: RefreshAdminAgentWorkflowInput) => Promise<RefreshAdminAgentWorkflowResult>;
  resume: (input: ResumeAdminAgentWorkflowInput) => Promise<ResumeAdminAgentWorkflowResult>;
  runType: AdminAgentRunType;
  start: (input: StartAdminAgentWorkflowInput) => Promise<StartAdminAgentWorkflowResult>;
  workflowName: AdminAgentWorkflowName;
};

interface AdminAgentWorkflowRegistry {
  findByName(workflowName: AdminAgentWorkflowName): AdminAgentWorkflowDefinition | null;
  listDefinitions(): AdminAgentWorkflowDefinition[];
}

const ADMIN_AGENT_WORKFLOW_REGISTRY = Symbol("ADMIN_AGENT_WORKFLOW_REGISTRY");

export { ADMIN_AGENT_WORKFLOW_REGISTRY };
export type {
  AdminAgentWorkflowDefinition,
  AdminAgentWorkflowRegistry,
  BranchAdminAgentWorkflowInput,
  BranchAdminAgentWorkflowResult,
  RefreshAdminAgentWorkflowInput,
  RefreshAdminAgentWorkflowResult,
  ResumeAdminAgentWorkflowInput,
  ResumeAdminAgentWorkflowResult,
  StartAdminAgentWorkflowInput,
  StartAdminAgentWorkflowResult,
};
