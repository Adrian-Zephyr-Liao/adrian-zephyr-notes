import type { AdminAgentFinding, AdminAgentFindingDraft } from "./admin-agent-finding.entity";
import type { AdminAgentCommentForAnalysis } from "./admin-agent-comment-analysis";
import type {
  AdminAgentDecisionEffect,
  EnsureAdminAgentDecisionEffectInput,
} from "./admin-agent-decision-effect.entity";
import type {
  AdminAgentParentRunRelation,
  AdminAgentRun,
  AdminAgentRunStatus,
  AdminAgentRunType,
  AdminAgentWorkflowName,
} from "./admin-agent-run.entity";
import type {
  AdminAgentWorkflowActionExecution,
  AdminAgentWorkflowActionExecutionClaim,
  EnsureAdminAgentWorkflowActionExecutionInput,
} from "./admin-agent-workflow-action-execution.entity";
import type { AdminAgentWorkflowActionExecutionResult } from "./admin-agent-workflow-action-executor";
import type {
  AdminAgentWorkflowEvent,
  AdminAgentWorkflowEventType,
} from "./admin-agent-workflow-event.entity";
import type { AdminAgentWorkflowNode } from "./admin-agent-workflow-node";

type CreateAdminAgentRunInput = {
  dedupeKey?: string | null;
  id?: string;
  type: AdminAgentRunType;
  workflowName: AdminAgentWorkflowName;
  threadId?: string | null;
  parentRunId?: string | null;
  parentRunRelation?: AdminAgentParentRunRelation | null;
  startedByUserId: string | null;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

type CreateAdminAgentWorkflowEventInput = {
  node?: string | null;
  payload?: Record<string, unknown> | null;
  runId: string;
  summary?: string | null;
  type: AdminAgentWorkflowEventType;
};

type MarkAdminAgentRunInterruptedOptions = {
  approvalNode?: AdminAgentWorkflowNode | null;
};

type ListTodayVisibleCommentsForAnalysisInput = {
  todayStart: Date;
  todayEnd: Date;
  limit: number;
};

type ListRecentVisibleCommentsForAnalysisInput = {
  limit: number;
};

type ListAdminAgentRunsFilters = {
  page: number;
  pageSize: number;
  parentRunId?: string;
  parentRunRelation?: AdminAgentParentRunRelation;
  rootOnly?: boolean;
  status?: AdminAgentRunStatus;
  workflowName?: AdminAgentWorkflowName;
};

type ListAdminAgentRunsResult = {
  data: AdminAgentRun[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ListRepairableAdminAgentDecisionEffectsInput = {
  limit: number;
  runId?: string;
};

interface AdminAgentRepository {
  createRun(input: CreateAdminAgentRunInput): Promise<AdminAgentRun>;
  createWorkflowEvent(input: CreateAdminAgentWorkflowEventInput): Promise<AdminAgentWorkflowEvent>;
  findRunById(id: string): Promise<AdminAgentRun | null>;
  findRunByThreadId(threadId: string): Promise<AdminAgentRun | null>;
  listLatestWorkflowEventsByRunIds(runIds: string[]): Promise<AdminAgentWorkflowEvent[]>;
  listWorkflowEventsByRunId(runId: string): Promise<AdminAgentWorkflowEvent[]>;
  listRuns(filters: ListAdminAgentRunsFilters): Promise<ListAdminAgentRunsResult>;
  markRunRunning(id: string, options?: { resumed?: boolean }): Promise<AdminAgentRun>;
  markRunNode(
    id: string,
    currentNode: AdminAgentWorkflowNode,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  markRunInterrupted(
    id: string,
    interruption: Record<string, unknown>,
    summary: string,
    options?: MarkAdminAgentRunInterruptedOptions,
  ): Promise<AdminAgentRun>;
  markRunWaitingForApproval(id: string, summary: string): Promise<AdminAgentRun>;
  completeRun(
    id: string,
    summary: string,
    output?: Record<string, unknown> | null,
  ): Promise<AdminAgentRun>;
  cancelRun(id: string, summary: string): Promise<AdminAgentRun>;
  failRun(id: string, errorMessage: string): Promise<AdminAgentRun>;
  ensureDecisionEffect(
    input: EnsureAdminAgentDecisionEffectInput,
  ): Promise<AdminAgentDecisionEffect>;
  listRepairableDecisionEffects(
    input: ListRepairableAdminAgentDecisionEffectsInput,
  ): Promise<AdminAgentDecisionEffect[]>;
  markDecisionEffectFailed(id: string, errorMessage: string): Promise<AdminAgentDecisionEffect>;
  markDecisionEffectSucceeded(id: string): Promise<AdminAgentDecisionEffect>;
  findFindingById(id: string): Promise<AdminAgentFinding | null>;
  markFindingExecuted(id: string): Promise<AdminAgentFinding>;
  markFindingFailed(id: string): Promise<AdminAgentFinding>;
  markFindingRejected(id: string): Promise<AdminAgentFinding>;
  markFindingRestored(id: string): Promise<AdminAgentFinding>;
  listTodayVisibleCommentsForAnalysis(
    input: ListTodayVisibleCommentsForAnalysisInput,
  ): Promise<AdminAgentCommentForAnalysis[]>;
  listRecentVisibleCommentsForAnalysis(
    input: ListRecentVisibleCommentsForAnalysisInput,
  ): Promise<AdminAgentCommentForAnalysis[]>;
  createFindings(runId: string, findings: AdminAgentFindingDraft[]): Promise<AdminAgentFinding[]>;
  ensureWorkflowActionExecution(
    input: EnsureAdminAgentWorkflowActionExecutionInput,
  ): Promise<AdminAgentWorkflowActionExecutionClaim>;
  listFindingsByIds(ids: string[]): Promise<AdminAgentFinding[]>;
  listPendingFindingsByTargetIds(targetIds: string[]): Promise<AdminAgentFinding[]>;
  listFindingsByRunId(runId: string): Promise<AdminAgentFinding[]>;
  markWorkflowActionExecutionFailed(
    id: string,
    errorMessage: string,
  ): Promise<AdminAgentWorkflowActionExecution>;
  markWorkflowActionExecutionSucceeded(
    id: string,
    result: AdminAgentWorkflowActionExecutionResult,
  ): Promise<AdminAgentWorkflowActionExecution>;
}

const ADMIN_AGENT_REPOSITORY = Symbol("ADMIN_AGENT_REPOSITORY");

export { ADMIN_AGENT_REPOSITORY };
export type {
  AdminAgentRepository,
  CreateAdminAgentRunInput,
  CreateAdminAgentWorkflowEventInput,
  ListAdminAgentRunsFilters,
  ListAdminAgentRunsResult,
  ListRepairableAdminAgentDecisionEffectsInput,
  MarkAdminAgentRunInterruptedOptions,
  ListRecentVisibleCommentsForAnalysisInput,
  ListTodayVisibleCommentsForAnalysisInput,
};
