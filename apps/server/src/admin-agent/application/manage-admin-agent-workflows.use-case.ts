import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  adminAgentWorkflowNames,
  type AdminAgentRun,
  type AdminAgentParentRunRelation,
  type AdminAgentWorkflowName,
} from "../domain/admin-agent-run.entity";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import type {
  AdminAgentRepository,
  ListAdminAgentRunsFilters,
} from "../domain/admin-agent.repository";
import { ADMIN_AGENT_REPOSITORY } from "../domain/admin-agent.repository";
import {
  ADMIN_AGENT_WORKFLOW_REGISTRY,
  type AdminAgentWorkflowDefinition,
  type AdminAgentWorkflowRegistry,
  type ResumeAdminAgentWorkflowInput,
  type StartAdminAgentWorkflowInput,
} from "../domain/admin-agent-workflow-definition";
import {
  getAdminAgentWorkflowControl,
  isAdminAgentWorkflowHumanApprovalSupported,
  isAdminAgentWorkflowStartSupported,
  toAdminAgentTaskName,
  toAdminAgentWorkflowLabel,
  type AdminAgentWorkflowTaskControlAction,
} from "../domain/admin-agent-workflow-metadata";
import { toAdminAgentWorkflowRetryInput } from "../domain/admin-agent-workflow-run-input";
import {
  AdminAgentWorkflowInvalidResumeError,
  type AdminAgentWorkflowResult,
} from "../domain/admin-agent-workflow-runner";
import type { AdminAgentWorkflowEvent } from "../domain/admin-agent-workflow-event.entity";
import { RepairAdminAgentDecisionEffectsUseCase } from "./repair-admin-agent-decision-effects.use-case";
import { createAdminAgentWorkflowControlledEvent } from "../domain/admin-agent-workflow-lifecycle";

type ListAdminAgentWorkflowRunsInput = {
  page?: number;
  pageSize?: number;
  parentRunId?: string;
  parentRunRelation?: string;
  rootOnly?: boolean;
  status?: string;
  workflowName?: string;
};

type StartAdminAgentWorkflowControlInput = {
  actor?: AdminOperationActor;
  input?: Record<string, unknown> | null;
  requestContext?: AdminOperationRequestContext;
  startedByUserId: string | null;
  workflowName: AdminAgentWorkflowName;
};

type RetryAdminAgentWorkflowInput = {
  startedByUserId: string | null;
};

type BranchAdminAgentWorkflowInput = {
  startedByUserId: string | null;
};

type ControlAdminAgentWorkflowInput = {
  action: AdminAgentWorkflowTaskControlAction;
  actor?: AdminOperationActor;
  requestContext?: AdminOperationRequestContext;
  runId: string;
  startedByUserId: string | null;
};

type ResumeAdminAgentWorkflowRunInput = {
  actor: AdminOperationActor;
  requestContext?: AdminOperationRequestContext;
  resume: ResumeAdminAgentWorkflowInput["resume"];
  runId: string;
};

type AdminAgentWorkflowResultWithEvents = AdminAgentWorkflowResult & {
  events: AdminAgentWorkflowEvent[];
};

type AdminAgentWorkflowControl = NonNullable<ReturnType<typeof getAdminAgentWorkflowControl>>;

type ListAdminAgentWorkflowRunsResultWithEvents = {
  data: AdminAgentRun[];
  latestEventsByRunId: ReadonlyMap<string, AdminAgentWorkflowEvent>;
  pagination: Awaited<ReturnType<AdminAgentRepository["listRuns"]>>["pagination"];
};

const maxWorkflowRunPageSize = 50;
@Injectable()
class ManageAdminAgentWorkflowsUseCase {
  private readonly logger = new Logger(ManageAdminAgentWorkflowsUseCase.name);

  constructor(
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
    @Inject(ADMIN_AGENT_WORKFLOW_REGISTRY)
    private readonly adminAgentWorkflowRegistry: AdminAgentWorkflowRegistry,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly repairAdminAgentDecisionEffects: RepairAdminAgentDecisionEffectsUseCase,
  ) {}

  async listRuns(
    input: ListAdminAgentWorkflowRunsInput = {},
  ): Promise<ListAdminAgentWorkflowRunsResultWithEvents> {
    const result = await this.adminAgentRepository.listRuns(
      normalizeListAdminAgentWorkflowRunsInput(input),
    );
    const latestEvents = await this.adminAgentRepository.listLatestWorkflowEventsByRunIds(
      result.data.map((run) => run.id),
    );

    return {
      ...result,
      latestEventsByRunId: new Map(latestEvents.map((event) => [event.runId, event])),
    };
  }

  async getRun(runId: string) {
    const run = await this.adminAgentRepository.findRunById(runId);

    if (!run) {
      throw new AdminAgentWorkflowNotFoundError(runId);
    }

    return run;
  }

  async startWorkflow(input: StartAdminAgentWorkflowControlInput) {
    if (!isAdminAgentWorkflowStartSupported(input.workflowName)) {
      throw new AdminAgentWorkflowStartUnsupportedError("workflow-definition", input.workflowName);
    }

    const definition = this.getWorkflowDefinition(input.workflowName);

    const result = await definition.start({
      input: input.input ?? null,
      startedByUserId: input.startedByUserId,
      startReason: "MANUAL",
    });

    await this.recordTaskAudit(input.actor, {
      action: "ADMIN_AGENT_TASK_STARTED",
      metadata: {
        source: "admin_agent",
        status: result.run.status,
        taskTitle: toAdminAgentWorkflowLabel(input.workflowName),
        taskName: toAdminAgentTaskName(input.workflowName),
      },
      requestContext: input.requestContext,
      resourceId: result.run.id,
    });

    return this.withBusinessTimeline(result);
  }

  private async retryRun(
    sourceRun: AdminAgentRun,
    input: RetryAdminAgentWorkflowInput,
    definition: AdminAgentWorkflowDefinition,
  ) {
    return this.startSupportedWorkflowFromRun(sourceRun, {
      definition,
      startedByUserId: input.startedByUserId,
      startReason: "RETRY",
    });
  }

  private async branchRun(
    sourceRun: AdminAgentRun,
    input: BranchAdminAgentWorkflowInput,
    definition: AdminAgentWorkflowDefinition,
  ) {
    if (!sourceRun.threadId) {
      throw new AdminAgentWorkflowBranchUnavailableError(sourceRun.id, sourceRun.status);
    }

    return definition.branch({
      parentRunId: sourceRun.id,
      sourceThreadId: sourceRun.threadId,
      startedByUserId: input.startedByUserId,
    });
  }

  private async refreshRun(
    sourceRun: AdminAgentRun,
    input: ControlAdminAgentWorkflowInput,
    definition: AdminAgentWorkflowDefinition,
  ) {
    return definition.refresh({
      runId: sourceRun.id,
      startedByUserId: input.startedByUserId,
    });
  }

  private async cancelRun(sourceRun: AdminAgentRun): Promise<AdminAgentWorkflowResult> {
    const cancelledRun = await this.adminAgentRepository.cancelRun(
      sourceRun.id,
      `已取消${toAdminAgentWorkflowLabel(sourceRun.workflowName)}。`,
    );

    return {
      interruption: null,
      output: cancelledRun.output ?? {},
      run: cancelledRun,
      summary: cancelledRun.summary ?? "Agent 业务处理已取消。",
    };
  }

  async controlRun(input: ControlAdminAgentWorkflowInput) {
    const sourceRun = await this.getRun(input.runId);
    const control = getAdminAgentWorkflowControl(sourceRun.workflowName, input.action);

    if (!control) {
      throw new AdminAgentWorkflowUnsupportedControlActionError(input.runId, input.action);
    }

    const definition =
      input.action === "cancel"
        ? null
        : this.getWorkflowDefinition(sourceRun.workflowName, sourceRun.id);

    assertAdminAgentWorkflowControlAllowed(sourceRun, control);

    let result: AdminAgentWorkflowResult;

    if (input.action === "retry") {
      result = await this.retryRun(sourceRun, input, requireControlWorkflowDefinition(definition));
    } else if (input.action === "cancel") {
      result = await this.cancelRun(sourceRun);
    } else if (input.action === "refresh") {
      result = await this.refreshRun(
        sourceRun,
        input,
        requireControlWorkflowDefinition(definition),
      );
    } else if (input.action === "branch") {
      result = await this.branchRun(sourceRun, input, requireControlWorkflowDefinition(definition));
    } else {
      throw new AdminAgentWorkflowUnsupportedControlActionError(input.runId, input.action);
    }

    await this.repairDecisionEffects(result.run.id);

    if (input.action === "cancel" || input.action === "retry") {
      await this.refreshCompletedMultiTaskParent(sourceRun, input.startedByUserId);
    }

    await this.recordWorkflowControlEvent(sourceRun, input.action, result);

    await this.recordTaskAudit(input.actor, {
      action: "ADMIN_AGENT_TASK_CONTROLLED",
      metadata: {
        action: input.action,
        source: "admin_agent",
        status: result.run.status,
        taskTitle: toAdminAgentWorkflowLabel(sourceRun.workflowName),
        taskName: toAdminAgentTaskName(sourceRun.workflowName),
      },
      requestContext: input.requestContext,
      resourceId: sourceRun.id,
    });

    return this.withBusinessTimeline(result, sourceRun.id);
  }

  async resumeRun(input: ResumeAdminAgentWorkflowRunInput) {
    const sourceRun = await this.getRun(input.runId);

    if (!isAdminAgentWorkflowHumanApprovalSupported(sourceRun.workflowName)) {
      throw new AdminAgentWorkflowResumeUnsupportedError(sourceRun.id, sourceRun.workflowName);
    }

    if (sourceRun.status !== "WAITING_FOR_APPROVAL" || !sourceRun.threadId) {
      throw new AdminAgentWorkflowResumeUnavailableError(sourceRun.id, sourceRun.status);
    }

    assertValidResumePayload(sourceRun.workflowName, input.resume);

    const definition = this.getWorkflowDefinition(sourceRun.workflowName, sourceRun.id);

    const result = await definition.resume({
      actor: input.actor,
      requestContext: input.requestContext,
      resume: input.resume,
      threadId: sourceRun.threadId,
    });

    await this.repairDecisionEffects(result.run.id);
    await this.refreshCompletedMultiTaskParent(sourceRun, input.actor.id);
    await this.recordWorkflowControlEvent(sourceRun, "resume", result);
    await this.recordTaskAudit(input.actor, {
      action: "ADMIN_AGENT_TASK_RESUMED",
      metadata: {
        decision: typeof input.resume.decision === "string" ? input.resume.decision : null,
        source: "admin_agent",
        status: result.run.status,
        taskTitle: toAdminAgentWorkflowLabel(sourceRun.workflowName),
        taskName: toAdminAgentTaskName(sourceRun.workflowName),
      },
      requestContext: input.requestContext,
      resourceId: sourceRun.id,
    });

    return this.withBusinessTimeline(result, sourceRun.id);
  }

  private async withBusinessTimeline(
    result: AdminAgentWorkflowResult,
    sourceRunId?: string,
  ): Promise<AdminAgentWorkflowResultWithEvents> {
    const runIds = [...new Set([sourceRunId, result.run.id].filter(isNonEmptyString))];
    const eventGroups = await Promise.all(
      runIds.map((runId) => this.adminAgentRepository.listWorkflowEventsByRunId(runId)),
    );

    return {
      ...result,
      events: dedupeAndSortWorkflowEvents(eventGroups.flat()),
    };
  }

  private async recordTaskAudit(
    actor: AdminOperationActor | undefined,
    input: {
      action:
        | "ADMIN_AGENT_TASK_CONTROLLED"
        | "ADMIN_AGENT_TASK_RESUMED"
        | "ADMIN_AGENT_TASK_STARTED";
      metadata: Record<string, unknown>;
      requestContext?: AdminOperationRequestContext;
      resourceId: string;
    },
  ) {
    if (!actor) {
      return;
    }

    await this.recordAdminOperation.execute({
      action: input.action,
      actor,
      metadata: input.metadata,
      requestContext: input.requestContext,
      resourceId: input.resourceId,
      resourceType: "ADMIN_AGENT_TASK",
    });
  }

  private async repairDecisionEffects(runId: string) {
    try {
      await this.repairAdminAgentDecisionEffects.execute({ runId });
    } catch (error) {
      this.logger.warn(
        `Admin agent decision effect repair failed for run ${runId}: ${toWorkflowRepairFailureMessage(error)}`,
      );
    }
  }

  private async recordWorkflowControlEvent(
    sourceRun: AdminAgentRun,
    action: AdminAgentWorkflowTaskControlAction | "resume",
    result: AdminAgentWorkflowResult,
  ) {
    await this.adminAgentRepository.createWorkflowEvent(
      createAdminAgentWorkflowControlledEvent({
        action,
        resultRunId: result.run.id,
        resultStatus: result.run.status,
        runId: sourceRun.id,
        workflowName: sourceRun.workflowName,
      }),
    );
  }

  private startSupportedWorkflowFromRun(
    sourceRun: AdminAgentRun,
    input: Pick<StartAdminAgentWorkflowInput, "startedByUserId" | "startReason"> & {
      definition?: AdminAgentWorkflowDefinition;
    },
  ) {
    const definition =
      input.definition ?? this.getWorkflowDefinition(sourceRun.workflowName, sourceRun.id);

    return definition.start({
      input: toAdminAgentWorkflowRetryInput(sourceRun),
      parentRunId: sourceRun.id,
      startedByUserId: input.startedByUserId,
      startReason: input.startReason,
    });
  }

  private getWorkflowDefinition(
    workflowName: AdminAgentWorkflowName,
    runId = "workflow-definition",
  ): AdminAgentWorkflowDefinition {
    const definition = this.adminAgentWorkflowRegistry.findByName(workflowName);

    if (!definition) {
      throw new AdminAgentWorkflowUnsupportedError(runId, workflowName);
    }

    return definition;
  }

  private async refreshCompletedMultiTaskParent(
    sourceRun: AdminAgentRun,
    startedByUserId: string | null,
  ) {
    const parentRun = await this.findRefreshableMultiTaskParentRun(sourceRun);

    if (!parentRun) {
      return;
    }

    const definition = this.getWorkflowDefinition(parentRun.workflowName, parentRun.id);

    await definition.refresh({
      runId: parentRun.id,
      startedByUserId,
    });
  }

  private async findRefreshableMultiTaskParentRun(sourceRun: AdminAgentRun) {
    let currentRun = sourceRun;
    const visitedRunIds = new Set<string>([sourceRun.id]);

    while (
      currentRun.parentRunId &&
      (currentRun.parentRunRelation === "CHILD_TASK" || currentRun.parentRunRelation === "RETRY")
    ) {
      if (visitedRunIds.has(currentRun.parentRunId)) {
        return null;
      }

      visitedRunIds.add(currentRun.parentRunId);

      const parentRun = await this.adminAgentRepository.findRunById(currentRun.parentRunId);

      if (!parentRun) {
        return null;
      }

      if (currentRun.parentRunRelation === "CHILD_TASK") {
        return parentRun.workflowName === "MULTI_TASK_ORCHESTRATION" &&
          (parentRun.status === "COMPLETED" || parentRun.status === "FAILED")
          ? parentRun
          : null;
      }

      currentRun = parentRun;
    }

    return null;
  }
}

class AdminAgentWorkflowNotFoundError extends Error {
  constructor(readonly runId: string) {
    super(`Admin agent workflow run not found: ${runId}`);
  }
}

class AdminAgentWorkflowActiveRunRetryError extends Error {
  constructor(
    readonly runId: string,
    readonly status: AdminAgentRun["status"],
  ) {
    super(`Admin agent workflow run cannot be retried while ${status}: ${runId}`);
  }
}

class AdminAgentWorkflowBranchUnavailableError extends Error {
  constructor(
    readonly runId: string,
    readonly status: AdminAgentRun["status"],
  ) {
    super(`Admin agent workflow run cannot be branched while ${status}: ${runId}`);
  }
}

class AdminAgentWorkflowRefreshUnavailableError extends Error {
  constructor(
    readonly runId: string,
    readonly status: AdminAgentRun["status"],
  ) {
    super(`Admin agent task cannot be refreshed while ${status}: ${runId}`);
  }
}

class AdminAgentWorkflowCancelUnavailableError extends Error {
  constructor(
    readonly runId: string,
    readonly status: AdminAgentRun["status"],
  ) {
    super(`Admin agent task cannot be cancelled while ${status}: ${runId}`);
  }
}

class AdminAgentWorkflowUnsupportedError extends Error {
  constructor(
    readonly runId: string,
    readonly workflowName: AdminAgentWorkflowName,
  ) {
    super(`Admin agent workflow is not supported by the control plane: ${workflowName} (${runId})`);
  }
}

class AdminAgentWorkflowResumeUnavailableError extends Error {
  constructor(
    readonly runId: string,
    readonly status: AdminAgentRun["status"],
  ) {
    super(`Admin agent workflow run cannot be resumed while ${status}: ${runId}`);
  }
}

class AdminAgentWorkflowStartUnsupportedError extends Error {
  constructor(
    readonly runId: string,
    readonly workflowName: AdminAgentWorkflowName,
  ) {
    super(`Admin agent task cannot be started: ${workflowName} (${runId})`);
  }
}

class AdminAgentWorkflowResumeUnsupportedError extends Error {
  constructor(
    readonly runId: string,
    readonly workflowName: AdminAgentWorkflowName,
  ) {
    super(`Admin agent task does not support human approval resume: ${workflowName} (${runId})`);
  }
}

class AdminAgentWorkflowUnsupportedControlActionError extends Error {
  constructor(
    readonly runId: string,
    readonly action: string,
  ) {
    super(`Admin agent task control action is not supported: ${action} (${runId})`);
  }
}

function assertAdminAgentWorkflowControlAllowed(
  sourceRun: AdminAgentRun,
  control: AdminAgentWorkflowControl,
) {
  if (!control.allowedStatuses.includes(sourceRun.status)) {
    throwAdminAgentWorkflowControlUnavailable(sourceRun, control.action);
  }

  if (control.requiresPausedTask && !sourceRun.threadId) {
    throwAdminAgentWorkflowControlUnavailable(sourceRun, control.action);
  }
}

function throwAdminAgentWorkflowControlUnavailable(
  sourceRun: AdminAgentRun,
  action: AdminAgentWorkflowTaskControlAction,
): never {
  if (action === "branch") {
    throw new AdminAgentWorkflowBranchUnavailableError(sourceRun.id, sourceRun.status);
  }

  if (action === "cancel") {
    throw new AdminAgentWorkflowCancelUnavailableError(sourceRun.id, sourceRun.status);
  }

  if (action === "refresh") {
    throw new AdminAgentWorkflowRefreshUnavailableError(sourceRun.id, sourceRun.status);
  }

  throw new AdminAgentWorkflowActiveRunRetryError(sourceRun.id, sourceRun.status);
}

function requireControlWorkflowDefinition(
  definition: AdminAgentWorkflowDefinition | null,
): AdminAgentWorkflowDefinition {
  if (!definition) {
    throw new Error("Admin agent control workflow definition is required.");
  }

  return definition;
}

function normalizeListAdminAgentWorkflowRunsInput(
  input: ListAdminAgentWorkflowRunsInput,
): ListAdminAgentRunsFilters {
  return {
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), maxWorkflowRunPageSize),
    parentRunId: normalizeOptionalText(input.parentRunId),
    parentRunRelation: normalizeParentRunRelation(input.parentRunRelation),
    rootOnly: input.rootOnly === true,
    status: normalizeRunStatus(input.status),
    workflowName: normalizeWorkflowName(input.workflowName),
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return fallback;
  }

  return value;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeParentRunRelation(
  value: string | undefined,
): AdminAgentParentRunRelation | undefined {
  return value === "BRANCH" || value === "CHILD_TASK" || value === "RETRY" ? value : undefined;
}

function normalizeRunStatus(value: string | undefined): AdminAgentRun["status"] | undefined {
  return value === "CANCELLED" ||
    value === "COMPLETED" ||
    value === "FAILED" ||
    value === "PENDING" ||
    value === "RUNNING" ||
    value === "WAITING_FOR_APPROVAL"
    ? value
    : undefined;
}

function normalizeWorkflowName(value: string | undefined): AdminAgentWorkflowName | undefined {
  return adminAgentWorkflowNames.some((workflowName) => workflowName === value)
    ? (value as AdminAgentWorkflowName)
    : undefined;
}

function assertValidResumePayload(
  workflowName: AdminAgentRun["workflowName"],
  resume: unknown,
): asserts resume is Record<string, unknown> {
  if (
    typeof resume !== "object" ||
    resume === null ||
    Array.isArray(resume) ||
    Object.getPrototypeOf(resume) !== Object.prototype
  ) {
    throw new AdminAgentWorkflowInvalidResumeError(
      workflowName,
      "Admin agent resume payload must be an object.",
      null,
    );
  }

  if (Object.keys(resume).length === 0) {
    throw new AdminAgentWorkflowInvalidResumeError(
      workflowName,
      "Admin agent resume payload must include at least one field.",
      null,
    );
  }
}

function toWorkflowRepairFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown repair failure.";
}

function isNonEmptyString(input: string | undefined): input is string {
  return typeof input === "string" && input.length > 0;
}

function dedupeAndSortWorkflowEvents(events: AdminAgentWorkflowEvent[]) {
  const seen = new Set<string>();

  return events
    .filter((event) => {
      if (seen.has(event.id)) {
        return false;
      }

      seen.add(event.id);
      return true;
    })
    .sort((left, right) => {
      const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();

      return createdAtDiff === 0 ? left.id.localeCompare(right.id) : createdAtDiff;
    });
}

export {
  AdminAgentWorkflowActiveRunRetryError,
  AdminAgentWorkflowBranchUnavailableError,
  AdminAgentWorkflowCancelUnavailableError,
  AdminAgentWorkflowNotFoundError,
  AdminAgentWorkflowRefreshUnavailableError,
  AdminAgentWorkflowResumeUnavailableError,
  AdminAgentWorkflowResumeUnsupportedError,
  AdminAgentWorkflowStartUnsupportedError,
  AdminAgentWorkflowUnsupportedControlActionError,
  AdminAgentWorkflowUnsupportedError,
  ManageAdminAgentWorkflowsUseCase,
  normalizeListAdminAgentWorkflowRunsInput,
};
export type {
  ControlAdminAgentWorkflowInput,
  ListAdminAgentWorkflowRunsInput,
  ListAdminAgentWorkflowRunsResultWithEvents,
  ResumeAdminAgentWorkflowRunInput,
  StartAdminAgentWorkflowControlInput,
};
