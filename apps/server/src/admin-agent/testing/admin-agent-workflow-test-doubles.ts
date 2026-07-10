import type { ConfigService } from "@nestjs/config";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import {
  assertAdminAgentWorkflowActionExecutionMatchesInput,
  isAdminAgentWorkflowActionExecutionInProgress,
  type AdminAgentWorkflowActionExecution,
} from "../domain/admin-agent-workflow-action-execution.entity";
import type {
  AdminAgentCommentForAnalysis,
  AdminAgentCommentAnalysisPromptMessage,
} from "../domain/admin-agent-comment-analysis";
import type {
  AdminAgentFinding,
  AdminAgentFindingDraft,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import {
  createAdminAgentWorkflowCancelledEvent,
  createAdminAgentWorkflowCompletedEvent,
  createAdminAgentWorkflowFailedEvent,
  createAdminAgentWorkflowInterruptedEvent,
  createAdminAgentWorkflowNodeStartedEvent,
  createAdminAgentWorkflowRunAttemptEvent,
  createAdminAgentWorkflowRunCreatedEvent,
} from "../domain/admin-agent-workflow-lifecycle";
import { OpenAiCompatibleChatCompletionClient } from "../infrastructure/ai/openai-compatible-chat-completion.client";

type RecordingChatCompletionClient = OpenAiCompatibleChatCompletionClient & {
  calls: Array<{
    maxCompletionTokens?: number;
    messages: AdminAgentCommentAnalysisPromptMessage[];
    temperature?: number;
  }>;
};

class RecordingAdminAgentRepository implements AdminAgentRepository {
  completedRuns: Array<{ id: string; output: Record<string, unknown> | null; summary: string }> =
    [];
  createdFindings: AdminAgentFindingDraft[] = [];
  createdRuns: Array<Parameters<AdminAgentRepository["createRun"]>[0]> = [];
  failedRuns: Array<{ errorMessage: string; id: string }> = [];
  interruptedRuns: Array<{ id: string; node: string; summary: string }> = [];
  nodeUpdates: Array<{ id: string; node: string }> = [];
  runningTransitions: Array<{ id: string; resumed: boolean }> = [];
  workflowEvents: Array<Parameters<AdminAgentRepository["createWorkflowEvent"]>[0]> = [];
  private readonly actionExecutions = new Map<string, AdminAgentWorkflowActionExecution>();
  private readonly findings = new Map<string, AdminAgentFinding>();
  private readonly runs = new Map<string, AdminAgentRun>();

  constructor(
    private readonly input: {
      pendingFindings?: AdminAgentFinding[];
      recentComments?: AdminAgentCommentForAnalysis[];
      todayComments?: AdminAgentCommentForAnalysis[];
    } = {},
  ) {}

  async createRun(input: Parameters<AdminAgentRepository["createRun"]>[0]) {
    this.createdRuns.push(input);
    const run = createRun({
      dedupeKey: input.dedupeKey ?? null,
      id: input.id ?? `run-${this.createdRuns.length}`,
      input: input.input,
      metadata: input.metadata ?? null,
      parentRunId: input.parentRunId ?? null,
      parentRunRelation: input.parentRunRelation ?? null,
      startedByUserId: input.startedByUserId,
      threadId: input.threadId ?? input.id ?? null,
      type: input.type,
      workflowName: input.workflowName,
    });
    this.runs.set(run.id, run);
    await this.createWorkflowEvent(
      createAdminAgentWorkflowRunCreatedEvent({
        dedupeKey: run.dedupeKey,
        input: run.input,
        metadata: run.metadata,
        parentRunId: run.parentRunId,
        parentRunRelation: run.parentRunRelation,
        runId: run.id,
        workflowName: run.workflowName,
      }),
    );
    return run;
  }

  async createWorkflowEvent(input: Parameters<AdminAgentRepository["createWorkflowEvent"]>[0]) {
    this.workflowEvents.push(input);
    return {
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      id: `event-${this.workflowEvents.length}`,
      node: input.node ?? null,
      payload: input.payload ?? null,
      runId: input.runId,
      summary: input.summary ?? null,
      type: input.type,
    };
  }

  async ensureWorkflowActionExecution(
    input: Parameters<AdminAgentRepository["ensureWorkflowActionExecution"]>[0],
  ) {
    const key = `${input.runId}:${input.approvalId}`;
    const existing = this.actionExecutions.get(key);

    if (existing) {
      assertAdminAgentWorkflowActionExecutionMatchesInput(existing, input);

      if (existing.status === "SUCCEEDED") {
        return {
          claimStatus: "SUCCEEDED" as const,
          execution: existing,
        };
      }

      if (
        isAdminAgentWorkflowActionExecutionInProgress(
          existing,
          new Date("2026-07-04T10:01:00.000Z"),
        )
      ) {
        return {
          claimStatus: "IN_PROGRESS" as const,
          execution: existing,
        };
      }

      const execution = this.updateWorkflowActionExecution(existing.id, {
        errorMessage: null,
        result: null,
        status: "RUNNING",
      });

      return {
        claimStatus: "CLAIMED" as const,
        execution,
      };
    }

    const execution = {
      action: input.action,
      approvalId: input.approvalId,
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      errorMessage: null,
      id: `action-execution-${this.actionExecutions.size + 1}`,
      payload: input.payload,
      result: null,
      runId: input.runId,
      status: "RUNNING" as const,
      subject: input.subject,
      updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    };

    this.actionExecutions.set(key, execution);
    return {
      claimStatus: "CLAIMED" as const,
      execution,
    };
  }

  async markWorkflowActionExecutionSucceeded(
    id: string,
    result: Parameters<AdminAgentRepository["markWorkflowActionExecutionSucceeded"]>[1],
  ) {
    return this.updateWorkflowActionExecution(id, {
      errorMessage: null,
      result,
      status: "SUCCEEDED",
    });
  }

  async markWorkflowActionExecutionFailed(id: string, errorMessage: string) {
    return this.updateWorkflowActionExecution(id, {
      errorMessage,
      status: "FAILED",
    });
  }

  listWorkflowActionExecutions() {
    return [...this.actionExecutions.values()];
  }

  async ensureDecisionEffect(): Promise<
    Awaited<ReturnType<AdminAgentRepository["ensureDecisionEffect"]>>
  > {
    throw new Error("not used");
  }

  async listRepairableDecisionEffects(): Promise<
    Awaited<ReturnType<AdminAgentRepository["listRepairableDecisionEffects"]>>
  > {
    throw new Error("not used");
  }

  async markDecisionEffectSucceeded(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markDecisionEffectSucceeded"]>>
  > {
    throw new Error("not used");
  }

  async markDecisionEffectFailed(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markDecisionEffectFailed"]>>
  > {
    throw new Error("not used");
  }

  async findRunById(id: string) {
    return this.runs.get(id) ?? null;
  }

  async findRunByThreadId(threadId: string) {
    return [...this.runs.values()].find((run) => run.threadId === threadId) ?? null;
  }

  async listRuns(filters: Parameters<AdminAgentRepository["listRuns"]>[0]) {
    const data = [...this.runs.values()].filter(
      (run) =>
        (!filters.status || run.status === filters.status) &&
        (!filters.workflowName || run.workflowName === filters.workflowName) &&
        (!filters.parentRunId || run.parentRunId === filters.parentRunId) &&
        (!filters.parentRunRelation || run.parentRunRelation === filters.parentRunRelation) &&
        (!filters.rootOnly || run.parentRunId === null),
    );

    return {
      data,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: data.length,
        totalPages: Math.ceil(data.length / filters.pageSize),
      },
    };
  }

  async listWorkflowEventsByRunId(runId: string) {
    return this.workflowEvents
      .filter((event) => event.runId === runId)
      .map((event, index) => ({
        createdAt: new Date("2026-07-04T10:00:00.000Z"),
        id: `event-${index + 1}`,
        node: event.node ?? null,
        payload: event.payload ?? null,
        runId: event.runId,
        summary: event.summary ?? null,
        type: event.type,
      }));
  }

  async listLatestWorkflowEventsByRunIds(runIds: string[]) {
    const latestEvents = await Promise.all(
      runIds.map(async (runId) => {
        const events = await this.listWorkflowEventsByRunId(runId);
        return events.at(-1) ?? null;
      }),
    );

    return latestEvents.filter((event): event is NonNullable<typeof event> => Boolean(event));
  }

  async markRunRunning(id: string, options: { resumed?: boolean } = {}) {
    const run = this.requireRun(id);
    const attemptCount = run.attemptCount + 1;

    this.runningTransitions.push({ id, resumed: options.resumed === true });
    const updated = this.updateRun(id, {
      attemptCount,
      lastResumedAt: options.resumed ? new Date("2026-07-04T10:05:00.000Z") : null,
      status: "RUNNING",
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowRunAttemptEvent({
        attemptCount,
        resumed: options.resumed === true,
        runId: id,
        workflowName: run.workflowName,
      }),
    );
    return updated;
  }

  async markRunNode(
    id: string,
    currentNode: Parameters<AdminAgentRepository["markRunNode"]>[1],
    metadata?: Record<string, unknown>,
  ) {
    const run = this.requireRun(id);

    this.nodeUpdates.push({ id, node: currentNode });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowNodeStartedEvent({
        node: currentNode,
        payload: metadata ?? null,
        runId: id,
        workflowName: run.workflowName,
      }),
    );
    this.updateRun(id, { currentNode });
  }

  async markRunInterrupted(
    id: string,
    interruption: Record<string, unknown>,
    summary: string,
    options: Parameters<AdminAgentRepository["markRunInterrupted"]>[3] = {},
  ) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    const currentNode = options.approvalNode ?? "human_approval";

    this.interruptedRuns.push({ id, node: currentNode, summary });
    const updated = this.updateRun(id, {
      currentNode,
      interruption,
      status: "WAITING_FOR_APPROVAL",
      summary,
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowInterruptedEvent({
        approvalNode: currentNode,
        interruption,
        runId: id,
        summary,
      }),
    );
    return updated;
  }

  async markRunWaitingForApproval(id: string, summary: string) {
    return this.updateRun(id, { status: "WAITING_FOR_APPROVAL", summary });
  }

  async completeRun(id: string, summary: string, output: Record<string, unknown> | null = null) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    this.completedRuns.push({ id, output, summary });
    const updated = this.updateRun(id, {
      currentNode: "completed",
      errorMessage: null,
      interruption: null,
      output,
      status: "COMPLETED",
      summary,
    });
    await this.createWorkflowEvent(createAdminAgentWorkflowCompletedEvent({ runId: id, summary }));
    return updated;
  }

  async cancelRun(id: string, summary: string) {
    await this.createWorkflowEvent(createAdminAgentWorkflowCancelledEvent({ runId: id, summary }));
    return this.updateRun(id, {
      currentNode: "cancelled",
      errorMessage: null,
      interruption: null,
      status: "CANCELLED",
      summary,
    });
  }

  async failRun(id: string, errorMessage: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    this.failedRuns.push({ errorMessage, id });
    const updated = this.updateRun(id, {
      currentNode: "failed",
      errorMessage,
      status: "FAILED",
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowFailedEvent({ errorMessage, runId: id }),
    );
    return updated;
  }

  async findFindingById(id: string) {
    return this.findings.get(id) ?? null;
  }

  async markFindingExecuted(id: string) {
    return this.updateFinding(id, { status: "EXECUTED" });
  }

  async markFindingFailed(id: string) {
    return this.updateFinding(id, { status: "FAILED" });
  }

  async markFindingRejected(id: string) {
    return this.updateFinding(id, { status: "REJECTED" });
  }

  async markFindingRestored(id: string) {
    return this.updateFinding(id, { status: "RESTORED" });
  }

  async listTodayVisibleCommentsForAnalysis() {
    return this.input.todayComments ?? [];
  }

  async listRecentVisibleCommentsForAnalysis() {
    return this.input.recentComments ?? [];
  }

  async createFindings(runId: string, findings: AdminAgentFindingDraft[]) {
    this.createdFindings.push(...findings);
    return findings.map((finding, index) => {
      const created = createFindingFromDraft(finding, {
        id: `finding-${index + 1}`,
        runId,
      });
      this.findings.set(created.id, created);
      return created;
    });
  }

  async listPendingFindingsByTargetIds() {
    return this.input.pendingFindings ?? [];
  }

  async listFindingsByIds(ids: string[]) {
    const uniqueIds = new Set(ids);
    return [...this.findings.values()].filter((finding) => uniqueIds.has(finding.id));
  }

  async listFindingsByRunId(runId: string) {
    return [...this.findings.values()].filter((finding) => finding.runId === runId);
  }

  private updateRun(id: string, changes: Partial<AdminAgentRun>) {
    const run = this.requireRun(id);

    const updated = { ...run, ...changes };
    this.runs.set(id, updated);
    return updated;
  }

  private requireRun(id: string) {
    const run = this.runs.get(id);

    if (!run) {
      throw new Error(`Missing test run ${id}.`);
    }

    return run;
  }

  private updateFinding(id: string, changes: Partial<AdminAgentFinding>) {
    const finding = this.findings.get(id);

    if (!finding) {
      throw new Error(`Missing test finding ${id}.`);
    }

    const updated = { ...finding, ...changes };
    this.findings.set(id, updated);
    return updated;
  }

  private updateWorkflowActionExecution(
    id: string,
    changes: Partial<AdminAgentWorkflowActionExecution>,
  ) {
    const entry = [...this.actionExecutions.entries()].find(([, execution]) => execution.id === id);

    if (!entry) {
      throw new Error(`Missing test workflow action execution ${id}.`);
    }

    const [key, execution] = entry;
    const updated = {
      ...execution,
      ...changes,
      updatedAt: new Date("2026-07-04T10:01:00.000Z"),
    };

    this.actionExecutions.set(key, updated);
    return updated;
  }
}

class RecordingAdminAgentWorkflowActionExecutor implements AdminAgentWorkflowActionExecutor {
  calls: Array<{
    action: string;
    actor: Parameters<AdminAgentWorkflowActionExecutor["executeAction"]>[0]["actor"];
    findingIds: string[];
    payload: Record<string, unknown>;
    subject: string;
  }> = [];

  constructor(
    private readonly result: AdminAgentWorkflowActionExecutionResult = {
      appliedCount: 0,
      failedCount: 0,
      results: [],
    },
  ) {}

  async executeAction(input: Parameters<AdminAgentWorkflowActionExecutor["executeAction"]>[0]) {
    this.calls.push({
      action: input.action,
      actor: input.actor,
      findingIds: Array.isArray(input.payload.findingIds)
        ? input.payload.findingIds.filter(
            (findingId): findingId is string => typeof findingId === "string",
          )
        : [],
      payload: input.payload,
      subject: input.subject,
    });

    return this.result;
  }
}

function createChatCompletionClientDouble(response: string): RecordingChatCompletionClient {
  const calls: RecordingChatCompletionClient["calls"] = [];

  return {
    calls,
    async complete(input) {
      calls.push({
        maxCompletionTokens: input.maxCompletionTokens,
        messages: input.messages as AdminAgentCommentAnalysisPromptMessage[],
        temperature: input.temperature,
      });
      return response;
    },
  } as unknown as RecordingChatCompletionClient;
}

function createConfigServiceDouble() {
  return {
    get() {
      return "";
    },
  } as unknown as ConfigService;
}

function createComment(id: string, body = "评论内容"): AdminAgentCommentForAnalysis {
  return {
    article: {
      id: "article-1",
      slug: "article",
      title: "文章",
    },
    author: {
      id: "user-1",
      login: "adrian",
      name: "Adrian",
    },
    body,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    id,
    parent: null,
    status: "VISIBLE",
  };
}

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 0,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: null,
    status: "PENDING",
    summary: null,
    threadId: null,
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}

function createFindingFromDraft(
  draft: AdminAgentFindingDraft,
  overrides: Partial<AdminAgentFinding> = {},
): AdminAgentFinding {
  return {
    category: draft.category,
    confidence: draft.confidence,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    evidence: draft.evidence,
    executedAt: null,
    id: "finding-1",
    proposedAction: draft.proposedAction,
    reason: draft.reason,
    runId: "run-1",
    severity: draft.severity,
    status: "PENDING",
    target: null,
    targetId: draft.targetId,
    targetType: draft.targetType,
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    ...overrides,
  };
}

export {
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
  createChatCompletionClientDouble,
  createComment,
  createConfigServiceDouble,
  createFindingFromDraft,
  createRun,
};
export type { RecordingChatCompletionClient };
