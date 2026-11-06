import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  ADMIN_AGENT_REPOSITORY,
  type AdminAgentRepository,
} from "../domain/admin-agent.repository";
import {
  ADMIN_AGENT_COMMENT_SELECTION_READER,
  type AdminAgentCommentSelectionReader,
} from "../domain/admin-agent-comment-selection.reader";
import {
  ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR,
  type AdminAgentWorkflowActionExecutionResult,
  type AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import type {
  AdminAgentWorkflowResult,
  AdminAgentWorkflowRunner,
  BranchAdminAgentWorkflowRunnerInput,
  RefreshAdminAgentWorkflowRunnerInput,
  ResumeAdminAgentWorkflowRunnerInput,
  StartAdminAgentWorkflowRunnerInput,
} from "../domain/admin-agent-workflow-runner";
import {
  AdminAgentWorkflowExecutionError,
  AdminAgentWorkflowInvalidResumeError,
} from "../domain/admin-agent-workflow-runner";
import {
  authorizeGenericApprovalResume as authorizeGenericApprovalResumePayload,
  createGenericApprovalInterruption,
  createCommentModerationApprovalInterruption,
  toStoredCommentModerationApprovalInterruption,
  toCommentModerationApprovalResume,
  isGenericApprovalApproved,
  shouldRequestGenericApproval,
  toGenericApprovalResume,
  toStoredGenericApprovalInterruption,
  type AdminAgentGenericApprovalRequest,
  type CommentModerationApprovalResume,
  type GenericApprovalResume,
} from "../domain/admin-agent-workflow-approval";
import { createSiteConfigApprovalRequest } from "../domain/admin-agent-site-config-approval";
import type {
  AdminAgentCommentAnalysisScope,
  AdminAgentCommentForAnalysis,
} from "../domain/admin-agent-comment-analysis";
import {
  buildCommentAnalysisMessages,
  parseCommentAnalysisResponse,
} from "../domain/admin-agent-comment-analysis";
import type {
  AdminAgentFinding,
  AdminAgentFindingDraft,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import {
  buildMultiTaskPlanMessages,
  createMultiTaskApprovalRequest,
  createMultiTaskCompletionResult,
  normalizeMultiTaskPlan,
  parseMultiTaskPlanResponse,
  type MultiTaskChildResult,
  type MultiTaskPlanItem,
} from "../domain/admin-agent-multi-task-orchestration";
import {
  buildArticleAssistanceMessages,
  createArticleAssistanceCompletionResult,
  createEmptyArticleAssistanceAnalysisResult,
  parseArticleAssistanceResponse,
} from "../domain/admin-agent-article-assistance";
import { createArticleAssistanceApprovalRequest } from "../domain/admin-agent-article-assistance-approval";
import { createAuditReviewApprovalRequest } from "../domain/admin-agent-audit-review-approval";
import {
  buildAuditReviewMessages,
  createAuditReviewCompletionResult,
  createEmptyAuditReviewAnalysisResult,
  parseAuditReviewResponse,
} from "../domain/admin-agent-audit-review";
import {
  buildSiteConfigReviewMessages,
  createSiteConfigReviewCompletionResult,
  parseSiteConfigReviewResponse,
} from "../domain/admin-agent-site-config-review";
import {
  createCommentModerationCompletionResult,
  toAdminAgentWorkflowFailureMessage,
} from "../domain/admin-agent-workflow-output";
import {
  createAdminAgentWorkflowBranchRunInput,
  createAdminAgentWorkflowRunInput,
} from "../domain/admin-agent-workflow-run-input";
import type { AdminAgentWorkflowNode } from "../domain/admin-agent-workflow-node";
import {
  listAdminAgentWorkflowMetadata,
  toAdminAgentWorkflowApprovalNode,
} from "../domain/admin-agent-workflow-metadata";
import { runAdminAgentMultiTaskChildren } from "../application/run-admin-agent-multi-task-children";
import { GetAdminArticleByIdUseCase } from "../../articles/application/get-admin-article-by-id.use-case";
import { ListAdminArticlesUseCase } from "../../articles/application/list-admin-articles.use-case";
import type {
  AdminArticleDetail,
  AdminArticleListItem,
} from "../../articles/domain/admin-article.repository";
import { ListAdminOperationLogsUseCase } from "../../audit/application/list-admin-operation-logs.use-case";
import type { AdminOperationLog } from "../../audit/domain/admin-operation-log";
import { GetAdminSiteConfigUseCase } from "../../site-config/application/get-admin-site-config.use-case";
import { createLocalDayRange } from "../application/get-admin-agent-home.use-case";
import { executeAdminAgentGenericApprovalAction } from "../application/execute-admin-agent-generic-approval-action";
import { executeCommentModerationApprovalAction } from "../application/execute-comment-moderation-approval-action";
import { createCommentModerationApprovalUpdate } from "../domain/admin-agent-workflow-output";
import { PiAdminAgentModelClient } from "./ai/pi-admin-agent-model.client";

import type { Storage, TaskId, ConversationId, TaskRuntime } from "@earendil-works/pi-durable";
import {
  BACKGROUND_CONTEXT,
  defineDoc,
  defineTask,
  createRegistry,
  defineExtension,
  Harness,
  createModels,
} from "./pi-admin-agent-runtime.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
import { openPiAdminAgentStorage } from "./pi-admin-agent-storage";
import { encodePiSnapshot, decodePiSnapshot } from "./pi-admin-agent-snapshot";
import { loadLegacyWorkflowImports } from "./pi-legacy-workflow-import";
import { AdminAgentWorkflowActionExecutionInProgressError } from "../domain/admin-agent-workflow-action-execution.entity";

type WorkflowState = {
  legacyCommentApproval?: boolean;
  runId: string;
  input: Record<string, unknown>;
  summary: string;
  output: Record<string, unknown>;
  approval: GenericApprovalResume | null;
  actionResult: AdminAgentWorkflowActionExecutionResult | null;
  comments: AdminAgentCommentForAnalysis[];
  findings: AdminAgentFinding[];
  scope: AdminAgentCommentAnalysisScope;
  article: AdminArticleDetail | null;
  articles: AdminArticleListItem[];
  logs: AdminOperationLog[];
  siteConfig: AdminSiteConfigSnapshot | null;
  plan: MultiTaskPlanItem[];
  childResults: MultiTaskChildResult[];
  startedByUserId: string | null;
};
type CommentModerationWorkflowState = Omit<WorkflowState, "approval"> & {
  approval: CommentModerationApprovalResume | null;
};
type ArticleAssistanceWorkflowState = WorkflowState;
type AuditReviewWorkflowState = WorkflowState;
type MultiTaskOrchestrationWorkflowState = WorkflowState;
type SiteConfigReviewWorkflowState = WorkflowState;
type SiteConfigResult = Awaited<ReturnType<GetAdminSiteConfigUseCase["execute"]>>;
type AdminSiteConfigSnapshot = {
  settings: SiteConfigResult["settings"];
  announcements: Array<Omit<SiteConfigResult["announcements"][number], never>>;
};
type Checkpoint = {
  phase: "step";
  node: string;
  snapshot: ReturnType<typeof encodePiSnapshot>;
  attempts: number;
  refresh?: boolean;
};
type WorkflowInput = {
  runId: string;
  workflowName: AdminAgentRun["workflowName"];
  checkpoint: Checkpoint;
};
type WorkflowSnapshot = { checkpoint: Checkpoint; taskId?: TaskId<null> };
type PiAdminAgentWorkflowOptions = { storage?: Storage };
const WorkflowDoc = defineDoc<WorkflowSnapshot>({
  kind: "az.workflow",
  version: 1,
  scope: "conversation",
  history: "rewindable",
  fork: "current",
  initial: () => ({
    checkpoint: { phase: "step", node: "", snapshot: { json: "{}", dates: [] }, attempts: 0 },
  }),
  checkpointWhen: () => true,
});
const IndexDoc = defineDoc<{ runs: Record<string, ConversationId> }>({
  kind: "az.workflows",
  version: 1,
  scope: "session",
  initial: () => ({ runs: {} }),
  checkpointWhen: () => true,
});
const context = BACKGROUND_CONTEXT;
const commentAnalysisLimit = 50;
const articleAssistanceLimit = 20;
const auditReviewLimit = 30;
const multiTaskChildRunLookupLimit = 50;
const nonRetryableHttpStatuses = new Set([400, 401, 402, 403, 404, 405, 406, 407, 409]);
const multiTaskOrchestrationWorkflowName = "MULTI_TASK_ORCHESTRATION";
const paths: Record<AdminAgentRun["workflowName"], string[]> = {
  COMMENT_MODERATION_ANALYSIS: [
    "load_comments",
    "analyze_comments",
    "persist_findings",
    "human_approval",
    "apply_approval",
    "complete",
  ],
  ARTICLE_ASSISTANCE: [
    "load_articles",
    "analyze_articles",
    "request_article_approval",
    "complete_article_assistance",
  ],
  AUDIT_REVIEW: [
    "load_audit_logs",
    "analyze_audit_logs",
    "request_audit_approval",
    "complete_audit_review",
  ],
  SITE_CONFIG_REVIEW: [
    "load_site_config",
    "analyze_site_config",
    "request_site_config_approval",
    "complete_site_config_review",
  ],
  MULTI_TASK_ORCHESTRATION: [
    "plan_multi_task",
    "request_multi_task_approval",
    "run_child_tasks",
    "complete_multi_task",
  ],
};

@Injectable()
class PiAdminAgentWorkflowRunner
  implements AdminAgentWorkflowRunner, OnModuleInit, OnModuleDestroy
{
  @Inject(ADMIN_AGENT_COMMENT_SELECTION_READER)
  private readonly commentSelectionReader?: AdminAgentCommentSelectionReader;
  private readonly execution = new AsyncLocalStorage<{ signal: AbortSignal; taskId: TaskId }>();
  private handle?: Awaited<ReturnType<typeof openPiAdminAgentStorage>>;
  private opening?: Promise<Harness>;
  private recovering?: Promise<void>;
  private started = false;
  private readonly lifecycle = new AbortController();
  private readonly logger = new Logger(PiAdminAgentWorkflowRunner.name);
  private readonly task = defineTask<WorkflowInput, Checkpoint, null>({
    name: "az.workflow",
    version: 1,
    initial: (input) => input.checkpoint,
    phases: {
      step: (task, runtime, taskContext) =>
        this.execution.run({ signal: runtime.signal, taskId: runtime.taskId }, () =>
          this.step(task.input, task.state.checkpoint, runtime, taskContext),
        ),
    },
    abort: async (task, runtime, taskContext) => {
      await this.adminAgentRepository.cancelRun(task.input.runId, "业务处理已取消。");
      await runtime.commit(
        () => ({ status: "terminal", outcome: { status: "aborted" } }),
        taskContext,
      );
    },
  });
  constructor(
    @Inject(ADMIN_AGENT_REPOSITORY) private readonly adminAgentRepository: AdminAgentRepository,
    @Inject(ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR)
    private readonly workflowActionExecutor: AdminAgentWorkflowActionExecutor,
    private readonly chatCompletionClient: PiAdminAgentModelClient,
    private readonly configService: ConfigService,
    @Optional() private readonly listAdminOperationLogs?: ListAdminOperationLogsUseCase,
    @Optional() private readonly getAdminSiteConfig?: GetAdminSiteConfigUseCase,
    @Optional() private readonly listAdminArticles?: ListAdminArticlesUseCase,
    @Optional() private readonly getAdminArticleById?: GetAdminArticleByIdUseCase,
    @Optional() private readonly options: PiAdminAgentWorkflowOptions = {},
  ) {
    assertAdminAgentWorkflowRuntimeCatalog(paths);
  }

  private open() {
    if (this.lifecycle.signal.aborted)
      return Promise.reject(new Error("Pi workflow runtime is shutting down."));
    if (this.opening) return this.opening;
    const opening = (async () => {
      const registry = createRegistry();
      registry.install(defineExtension({ name: "az-workflows", tasks: [this.task] }));
      let handle: Awaited<ReturnType<typeof openPiAdminAgentStorage>> | undefined;
      let harness: Harness | undefined;
      try {
        if (!this.options.storage) {
          handle = await openPiAdminAgentStorage(this.configService, "workflows");
          this.handle = handle;
        }
        harness = await Harness.open(
          this.options.storage ?? handle!.storage,
          { models: createModels(), registry },
          context,
        );
        const current = harness;
        const lost = () => {
          void current.close(context).catch(() => undefined);
        };
        handle?.ownershipLost.addEventListener("abort", lost, { once: true });
        void current.closed.then((end) => {
          handle?.ownershipLost.removeEventListener("abort", lost);
          if (end.kind === "failed" || handle?.ownershipLost.aborted)
            this.recoverRuntime(opening, handle);
        });
        this.lifecycle.signal.throwIfAborted();
        handle?.ownershipLost.throwIfAborted();
        return current;
      } catch (error) {
        await harness?.close(context).catch(() => undefined);
        await handle?.close().catch(() => undefined);
        if (this.handle === handle) this.handle = undefined;
        throw error;
      }
    })();
    this.opening = opening;
    void opening.catch(() => {
      if (this.opening === opening) this.opening = undefined;
    });
    return opening;
  }
  async onModuleInit() {
    try {
      await this.restoreTasks(await this.open());
      this.started = true;
    } catch (error) {
      await this.releaseRuntime(this.opening, this.handle);
      throw error;
    }
  }
  private async restoreTasks(harness: Harness) {
    for (const legacy of await loadLegacyWorkflowImports(
      this.configService,
      undefined,
      Object.keys((await harness.snapshot(IndexDoc, context))?.runs ?? {}),
    ))
      await this.importLegacyRun(legacy);
    // Recover the admission gap between creating the business run and committing its Pi task.
    for (const status of ["PENDING", "RUNNING", "WAITING_FOR_APPROVAL"] as const) {
      for (let page = 1; ; page++) {
        const runs = await this.adminAgentRepository.listRuns({ page, pageSize: 50, status });
        for (const run of runs.data) {
          const index = await harness.snapshot(IndexDoc, context);
          if (index?.runs[run.id]) continue;
          if (run.status !== "PENDING")
            throw new Error(
              `Pi state missing for active business run ${run.id}; restore runtime storage before restarting.`,
            );
          await this.schedule(run, {
            phase: "step",
            node: paths[run.workflowName][0]!,
            snapshot: encodePiSnapshot(
              this.initialState(run, (run.input.workflowInput ?? {}) as Record<string, unknown>),
            ),
            attempts: 0,
          });
        }
        if (page >= runs.pagination.totalPages) break;
      }
    }
    harness.resume();
  }
  private recoverRuntime(
    opening: Promise<Harness>,
    handle: Awaited<ReturnType<typeof openPiAdminAgentStorage>> | undefined,
  ) {
    if (
      !this.started ||
      this.lifecycle.signal.aborted ||
      this.options.storage ||
      this.opening !== opening
    )
      return;
    if (this.recovering) {
      void this.recovering
        .finally(() => this.recoverRuntime(opening, handle))
        .catch(() => undefined);
      return;
    }
    const recovering = (async () => {
      await this.releaseRuntime(opening, handle);
      for (let attempt = 0; !this.lifecycle.signal.aborted; attempt++) {
        const waitMs = Math.min(100 * 2 ** Math.min(attempt, 7), 10_000);
        try {
          await delay(waitMs, undefined, { signal: this.lifecycle.signal, ref: false });
          const harness = await this.open();
          await this.restoreTasks(harness);
          return;
        } catch (error) {
          await this.releaseRuntime(this.opening, this.handle);
          if (this.lifecycle.signal.aborted) return;
          this.logger.warn(
            `Pi workflow runtime recovery failed: ${toAdminAgentWorkflowFailureMessage(error)}`,
          );
        }
      }
    })();
    this.recovering = recovering;
    void recovering
      .finally(() => {
        if (this.recovering === recovering) this.recovering = undefined;
      })
      .catch(() => undefined);
  }
  private async releaseRuntime(
    opening: Promise<Harness> | undefined,
    handle: Awaited<ReturnType<typeof openPiAdminAgentStorage>> | undefined,
  ) {
    if (this.opening === opening) this.opening = undefined;
    if (this.handle === handle) this.handle = undefined;
    try {
      const harness = await opening?.catch(() => undefined);
      await harness?.close(context).catch(() => undefined);
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
  async onModuleDestroy() {
    this.lifecycle.abort();
    await this.releaseRuntime(this.opening, this.handle);
    await this.recovering;
  }
  private initialState(run: AdminAgentRun, input: Record<string, unknown>): WorkflowState {
    return {
      runId: run.id,
      input,
      summary: "",
      output: {},
      approval: null,
      actionResult: null,
      comments: [],
      findings: [],
      scope: "today",
      article: null,
      articles: [],
      logs: [],
      siteConfig: null,
      plan: [],
      childResults: [],
      startedByUserId: run.startedByUserId,
    };
  }
  private async schedule(
    run: AdminAgentRun,
    checkpoint: Checkpoint,
    conversationId?: ConversationId,
    admission: "start" | "resume" | "refresh" = "start",
  ) {
    const harness = await this.open();
    return harness.commit(async (tx) => {
      const index = await tx.doc(IndexDoc);
      const parent = this.execution.getStore();
      parent?.signal.throwIfAborted();
      const conversation =
        conversationId ??
        index.runs[run.id] ??
        (
          await tx.createConversation({
            ownership:
              parent && run.parentRunRelation === "CHILD_TASK"
                ? { kind: "task", taskId: parent.taskId }
                : { kind: "ownerless" },
          })
        ).id;
      const doc = await tx.doc(WorkflowDoc, conversation);
      const existing = doc.taskId ? await tx.task(doc.taskId) : undefined;
      const previous =
        admission === "resume" ? decodePiSnapshot<WorkflowState>(doc.checkpoint.snapshot) : null;
      const next =
        admission === "resume" ? decodePiSnapshot<WorkflowState>(checkpoint.snapshot) : null;
      const prior = previous?.approval;
      const incomingCommentApproval = next?.approval as
        | CommentModerationApprovalResume
        | null
        | undefined;
      // Legacy approvals allow a selected subset, which is part of the saved authorization.
      const differentCommentScope =
        prior &&
        previous?.legacyCommentApproval &&
        JSON.stringify(
          [...new Set((prior as CommentModerationApprovalResume).findingIds)].sort(),
        ) !== JSON.stringify([...new Set(incomingCommentApproval?.findingIds ?? [])].sort());
      if (prior && (prior.decision !== next?.approval?.decision || differentCommentScope))
        throw new AdminAgentWorkflowInvalidResumeError(
          run.workflowName,
          "A different approval decision was already admitted.",
          null,
        );
      if (existing && existing.state.status !== "terminal") return existing.id as TaskId<null>;
      if (admission === "start" && doc.taskId) return doc.taskId;
      if (admission === "resume" && doc.taskId && prior) return doc.taskId;
      const taskId = await tx.createTask(
        this.task,
        { runId: run.id, workflowName: run.workflowName, checkpoint },
        { conversationId: conversation, ownership: { kind: "conversation" } },
      );
      doc.checkpoint = checkpoint;
      doc.taskId = taskId;
      index.runs[run.id] = conversation;
      return taskId;
    }, context);
  }
  async importLegacyRun(legacy: { runId: string; next: string[]; state: Record<string, unknown> }) {
    const harness = await this.open();
    const index = await harness.snapshot(IndexDoc, context);
    if (index?.runs[legacy.runId]) return;
    const run = await this.adminAgentRepository.findRunById(legacy.runId);
    if (!run) throw new Error(`Legacy run missing: ${legacy.runId}`);
    const input = (run.input.workflowInput ?? run.input) as Record<string, unknown>;
    const state = { ...this.initialState(run, input), ...legacy.state, runId: run.id };
    if (
      run.workflowName === "COMMENT_MODERATION_ANALYSIS" &&
      (legacy.next.some((node) => node === "human_approval" || node === "apply_approval") ||
        run.interruption?.kind === "COMMENT_MODERATION_APPROVAL")
    )
      state.legacyCommentApproval = true;
    const node = legacy.next[0];
    if (!node)
      throw new Error(
        `Legacy run ${run.id} has no resumable phase; inspect its saved output before switching engines.`,
      );
    if (!paths[run.workflowName].includes(node))
      throw new Error(`Unsupported legacy phase: ${node}`);
    const checkpoint: Checkpoint = {
      phase: "step",
      node,
      snapshot: encodePiSnapshot(state),
      attempts: 0,
    };
    if (run.status === "WAITING_FOR_APPROVAL") {
      await harness.commit(async (tx) => {
        const indexDoc = await tx.doc(IndexDoc);
        const conversation = await tx.createConversation({ ownership: { kind: "ownerless" } });
        (await tx.doc(WorkflowDoc, conversation.id)).checkpoint = checkpoint;
        indexDoc.runs[run.id] = conversation.id;
      }, context);
    } else await this.schedule(run, checkpoint);
  }
  async startWorkflow(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    this.assertStartWorkflowInput(input);
    input.signal?.throwIfAborted();
    this.execution.getStore()?.signal.throwIfAborted();
    const runInput = createAdminAgentWorkflowRunInput(input, { runId: randomUUID() });
    const run = await this.adminAgentRepository.createRun({
      ...runInput,
      metadata: { ...runInput.metadata, engine: "pi" },
    });
    const checkpoint: Checkpoint = {
      phase: "step",
      node: paths[input.workflowName][0]!,
      snapshot: encodePiSnapshot(this.initialState(run, input.input ?? {})),
      attempts: 0,
    };
    const id = await this.schedule(run, checkpoint);
    const abort = () => {
      void this.cancelWorkflow(run.id).catch(() => undefined);
    };
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    try {
      return await this.wait(run.id, id);
    } finally {
      input.signal?.removeEventListener("abort", abort);
    }
  }
  private async wait(runId: string, id: TaskId<null>): Promise<AdminAgentWorkflowResult> {
    const harness = await this.open();
    const task = await harness.waitForTask(id, context);
    const run = (await this.adminAgentRepository.findRunById(runId))!;
    if (task.state.outcome.status === "faulted" || task.state.outcome.status === "failed")
      throw new AdminAgentWorkflowExecutionError(
        runId,
        task.state.outcome.error.message,
        task.state.outcome.error,
      );
    const { doc } = await this.snapshot(runId);
    const state = decodePiSnapshot<WorkflowState>(doc.checkpoint.snapshot);
    return {
      run,
      interruption: run.interruption as AdminAgentWorkflowResult["interruption"],
      output: run.output ?? state.output,
      summary: run.summary ?? state.summary,
      ...(run.workflowName === "COMMENT_MODERATION_ANALYSIS" ? { scope: state.scope } : {}),
    };
  }
  private async snapshot(runId: string) {
    const harness = await this.open();
    const index = await harness.snapshot(IndexDoc, context);
    const conversation = index?.runs[runId];
    if (!conversation) throw new Error(`Pi workflow snapshot missing: ${runId}`);
    const doc = await harness.snapshot(WorkflowDoc, conversation, context);
    if (!doc) throw new Error(`Pi workflow state missing: ${runId}`);
    return { conversation, doc };
  }
  async resumeWorkflow(
    input: ResumeAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    const run = await this.requireResumeRun(input);
    const { conversation, doc } = await this.snapshot(run.id);
    const state = decodePiSnapshot<WorkflowState>(doc.checkpoint.snapshot);
    let resume: GenericApprovalResume;
    if (state.legacyCommentApproval) {
      const pending = toStoredCommentModerationApprovalInterruption(run.interruption);
      let decision: CommentModerationApprovalResume;
      try {
        decision = toCommentModerationApprovalResume(input.resume);
      } catch (error) {
        throw new AdminAgentWorkflowInvalidResumeError(
          run.workflowName,
          toAdminAgentWorkflowFailureMessage(error),
          error,
        );
      }
      if (!pending || decision.findingIds.some((id) => !pending.findingIds.includes(id)))
        throw new AdminAgentWorkflowInvalidResumeError(
          run.workflowName,
          "Comment decision exceeds its saved approval scope.",
          null,
        );
      resume = decision;
    } else
      resume = this.authorizeGenericApprovalResumeForRun(
        input.workflowName,
        this.parseGenericApprovalResume(input),
        run,
      );
    state.approval = { ...resume, actor: input.actor, requestContext: input.requestContext };
    const path = paths[run.workflowName];
    const node = state.legacyCommentApproval
      ? "apply_approval"
      : path[path.findIndex((item) => item.startsWith("request_")) + 1]!;
    const checkpoint: Checkpoint = {
      phase: "step",
      node,
      snapshot: encodePiSnapshot(state),
      attempts: 0,
    };
    // Admission and the saved authenticated decision share one durable commit.
    const id = await this.schedule(run, checkpoint, conversation, "resume");
    return this.wait(run.id, id);
  }
  async branchWorkflow(
    input: BranchAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    const source = await this.requireBranchSourceRun(input);
    const { doc } = await this.snapshot(source.id);
    const branchInput = createAdminAgentWorkflowBranchRunInput(
      {
        sourceRun: source,
        sourceThreadId: input.sourceThreadId,
        startedByUserId: input.startedByUserId,
      },
      { runId: randomUUID() },
    );
    const run = await this.adminAgentRepository.createRun({
      ...branchInput,
      metadata: { ...branchInput.metadata, engine: "pi" },
    });
    const state = decodePiSnapshot<WorkflowState>(doc.checkpoint.snapshot);
    state.runId = run.id;
    state.approval = null;
    state.startedByUserId = input.startedByUserId;
    const checkpoint = { ...doc.checkpoint, snapshot: encodePiSnapshot(state), attempts: 0 };
    const id = await this.schedule(run, checkpoint);
    return this.wait(run.id, id);
  }
  async refreshWorkflow(
    input: RefreshAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    const run = await this.adminAgentRepository.findRunById(input.runId);
    if (!run || run.workflowName !== multiTaskOrchestrationWorkflowName)
      throw new Error(`Multi-task orchestration run not found: ${input.runId}`);
    if (run.status !== "COMPLETED" && run.status !== "FAILED")
      throw new Error(
        `Multi-task orchestration run cannot be refreshed while ${run.status}: ${run.id}`,
      );
    const { conversation, doc } = await this.snapshot(run.id);
    const state = decodePiSnapshot<WorkflowState>(doc.checkpoint.snapshot);
    state.startedByUserId = input.startedByUserId;
    const id = await this.schedule(
      run,
      {
        phase: "step",
        node: "run_child_tasks",
        snapshot: encodePiSnapshot(state),
        attempts: 0,
        refresh: true,
      },
      conversation,
      "refresh",
    );
    return this.wait(run.id, id);
  }
  async cancelWorkflow(runId: string) {
    const harness = await this.open();
    await this.adminAgentRepository.cancelRun(runId, "业务处理已取消。");
    const index = await harness.snapshot(IndexDoc, context);
    const conversation = index?.runs[runId];
    const doc = conversation
      ? await harness.snapshot(WorkflowDoc, conversation, context)
      : undefined;
    const aborting = doc?.taskId ? harness.abortTask(doc.taskId, context) : Promise.resolve();
    // Business children have independent conversations, so cancellation follows the stored child relation.
    let page = 1;
    for (;;) {
      const children = await this.adminAgentRepository.listRuns({
        parentRunId: runId,
        parentRunRelation: "CHILD_TASK",
        page,
        pageSize: 50,
      });
      for (const child of children.data)
        if (["PENDING", "RUNNING", "WAITING_FOR_APPROVAL"].includes(child.status))
          await this.cancelWorkflow(child.id);
      if (children.data.length < 50) break;
      page++;
    }
    await aborting;
  }
  private async step(
    input: WorkflowInput,
    checkpoint: Checkpoint,
    runtime: TaskRuntime<WorkflowInput, Checkpoint, null, object>,
    taskContext: typeof context,
  ) {
    const state = decodePiSnapshot<WorkflowState>(checkpoint.snapshot);
    try {
      runtime.signal.throwIfAborted();
      let run = await this.adminAgentRepository.findRunById(input.runId);
      if (!run || run.status === "CANCELLED") {
        await runtime.commit(
          () => ({ status: "terminal", outcome: { status: "aborted" } }),
          taskContext,
        );
        return;
      }
      // The explicit refresh intent is durable before its business projection changes.
      if (checkpoint.refresh && (run.status === "COMPLETED" || run.status === "FAILED")) {
        run = await this.adminAgentRepository.markRunRunning(run.id, { resumed: true });
      }
      if (run.status === "COMPLETED" && checkpoint.node === paths[input.workflowName].at(-1)) {
        const saved = {
          ...checkpoint,
          snapshot: encodePiSnapshot({
            ...state,
            output: run.output ?? state.output,
            summary: run.summary ?? state.summary,
          }),
        };
        await runtime.commit(async (tx) => {
          (await tx.doc(WorkflowDoc, runtime.conversationId)).checkpoint = saved;
          return { status: "terminal", outcome: { status: "completed", result: null } };
        }, taskContext);
        return;
      }
      if (run.status === "FAILED") {
        await runtime.commit(
          () => ({
            status: "terminal",
            outcome: { status: "failed", error: { message: run.errorMessage ?? "业务处理失败。" } },
          }),
          taskContext,
        );
        return;
      }
      if (run.status === "PENDING" || run.status === "WAITING_FOR_APPROVAL")
        await this.adminAgentRepository.markRunRunning(run.id, {
          resumed: run.status === "WAITING_FOR_APPROVAL",
        });
      if (checkpoint.node === "human_approval" && state.legacyCommentApproval) {
        const interruption =
          toStoredCommentModerationApprovalInterruption(run.interruption) ??
          createCommentModerationApprovalInterruption({
            runId: run.id,
            scope: state.scope,
            findingIds: state.findings
              .filter((item) => item.status === "PENDING" && item.proposedAction !== "NO_ACTION")
              .map((item) => item.id),
          });
        await this.adminAgentRepository.markRunInterrupted(
          run.id,
          interruption,
          interruption.summary,
          { approvalNode: "human_approval" },
        );
        await runtime.commit(async (tx) => {
          (await tx.doc(WorkflowDoc, runtime.conversationId)).checkpoint = checkpoint;
          return { status: "terminal", outcome: { status: "completed", result: null } };
        }, taskContext);
        return;
      } else if (checkpoint.node.startsWith("request_")) {
        if (
          shouldRequestGenericApproval(state.input) &&
          (input.workflowName !== multiTaskOrchestrationWorkflowName || state.plan.length)
        ) {
          const request = this.approvalRequest(input.workflowName, state);
          const interruption = createGenericApprovalInterruption({
            ...request,
            runId: state.runId,
          });
          await this.adminAgentRepository.markRunInterrupted(
            state.runId,
            interruption,
            interruption.summary,
            { approvalNode: toAdminAgentWorkflowApprovalNode(input.workflowName) },
          );
          await runtime.commit(async (tx) => {
            (await tx.doc(WorkflowDoc, runtime.conversationId)).checkpoint = checkpoint;
            return { status: "terminal", outcome: { status: "completed", result: null } };
          }, taskContext);
          return;
        }
      } else Object.assign(state, await this.executeStep(checkpoint.node, state));
      runtime.signal.throwIfAborted();
      const path = paths[input.workflowName];
      const next = path[path.indexOf(checkpoint.node) + 1];
      const saved: Checkpoint = {
        ...checkpoint,
        refresh: false,
        node: next ?? checkpoint.node,
        snapshot: encodePiSnapshot(state),
        attempts: 0,
      };
      await runtime.commit(async (tx) => {
        (await tx.doc(WorkflowDoc, runtime.conversationId)).checkpoint = saved;
        return next
          ? { status: "running", checkpoint: saved }
          : { status: "terminal", outcome: { status: "completed", result: null } };
      }, taskContext);
    } catch (error) {
      if (runtime.signal.aborted) throw error;
      if (error instanceof AdminAgentWorkflowActionExecutionInProgressError) {
        await runtime.sleepUntil(
          Math.max(runtime.now() + 50, error.retryAt.getTime()),
          checkpoint,
          taskContext,
        );
        return;
      }
      if (checkpoint.attempts < 2 && isRetryableWorkflowError(error)) {
        await runtime.sleepUntil(
          runtime.now() + 50 * 2 ** checkpoint.attempts,
          { ...checkpoint, attempts: checkpoint.attempts + 1 },
          taskContext,
        );
        return;
      }
      const message = toAdminAgentWorkflowFailureMessage(error);
      await this.adminAgentRepository.failRun(input.runId, message);
      await runtime.commit(
        () => ({ status: "terminal", outcome: { status: "failed", error: { message } } }),
        taskContext,
      );
    }
  }
  private approvalRequest(
    name: AdminAgentRun["workflowName"],
    state: WorkflowState,
  ): AdminAgentGenericApprovalRequest {
    switch (name) {
      case "ARTICLE_ASSISTANCE":
        return createArticleAssistanceApprovalRequest({
          detailArticleId: state.article?.id ?? null,
          output: state.output,
          summary: state.summary,
        });
      case "AUDIT_REVIEW":
        return createAuditReviewApprovalRequest({
          logCount: state.logs.length,
          output: state.output,
          summary: state.summary,
        });
      case "SITE_CONFIG_REVIEW":
        return {
          ...createSiteConfigApprovalRequest(state.input, state.output),
          summary: state.summary,
        };
      case "MULTI_TASK_ORCHESTRATION":
        return createMultiTaskApprovalRequest({ plan: state.plan, summary: state.summary });
      default:
        throw new Error(`Unsupported approval workflow: ${name}`);
    }
  }
  private executeStep(node: string, state: WorkflowState): Promise<unknown> {
    switch (node) {
      case "load_comments":
        return this.loadComments(state as CommentModerationWorkflowState);
      case "analyze_comments":
        return this.analyzeComments(state as CommentModerationWorkflowState);
      case "persist_findings":
        return this.persistFindings(state as CommentModerationWorkflowState);
      case "human_approval":
        return Promise.resolve({});
      case "apply_approval":
        return this.applyLegacyCommentApproval(state);
      case "complete":
        return this.complete(state as CommentModerationWorkflowState);
      case "load_articles":
        return this.loadArticles(state);
      case "analyze_articles":
        return this.analyzeArticles(state);
      case "complete_article_assistance":
        return this.completeArticleAssistance(state);
      case "load_audit_logs":
        return this.loadAuditLogs(state);
      case "analyze_audit_logs":
        return this.analyzeAuditLogs(state);
      case "complete_audit_review":
        return this.completeAuditReview(state);
      case "load_site_config":
        return this.loadSiteConfig(state);
      case "analyze_site_config":
        return this.analyzeSiteConfig(state);
      case "complete_site_config_review":
        return this.completeSiteConfigReview(state);
      case "plan_multi_task":
        return this.planMultiTask(state);
      case "run_child_tasks":
        return this.runChildTasks(state);
      case "complete_multi_task":
        return this.completeMultiTask(state);
      default:
        throw new AdminAgentWorkflowConfigurationError(`Unknown Pi workflow step: ${node}`);
    }
  }
  private async applyLegacyCommentApproval(state: WorkflowState) {
    if (!state.legacyCommentApproval) return {};
    this.execution.getStore()?.signal.throwIfAborted();
    const approval = state.approval as CommentModerationApprovalResume | null;
    const actionResult =
      approval?.decision === "APPROVE"
        ? await executeCommentModerationApprovalAction({
            actionExecutor: this.workflowActionExecutor,
            approval,
            repository: this.adminAgentRepository,
            runId: state.runId,
          })
        : null;
    return createCommentModerationApprovalUpdate({
      actionResult,
      approval,
      findingCount: state.findings.length,
      summary: state.summary,
    });
  }
  private assertStartWorkflowInput(input: StartAdminAgentWorkflowRunnerInput) {
    const startReason = input.startReason ?? "MANUAL";

    if (startReason === "BRANCH") {
      throw new Error(
        `Admin agent branch workflows must be started through branchWorkflow: ${input.workflowName}`,
      );
    }

    if (startReason === "RETRY" && !input.parentRunId) {
      throw new Error(`Admin agent retry workflows require parentRunId: ${input.workflowName}`);
    }

    if (startReason === "MANUAL" && input.parentRunId) {
      throw new Error(
        `Admin agent manual workflows cannot attach parentRunId: ${input.workflowName}`,
      );
    }

    if (startReason === "CHAT_INTENT" && input.parentRunId && !input.dedupeKey) {
      throw new Error(
        `Admin agent child workflows require a dedupeKey when parentRunId is set: ${input.workflowName}`,
      );
    }
  }

  private async requireBranchSourceRun(input: BranchAdminAgentWorkflowRunnerInput) {
    const sourceRun = await this.adminAgentRepository.findRunById(input.parentRunId);

    if (!sourceRun || sourceRun.threadId !== input.sourceThreadId) {
      throw new Error(`Admin agent branch source not found: ${input.parentRunId}`);
    }

    if (sourceRun.workflowName !== input.workflowName) {
      throw new Error(`Admin agent branch source workflow mismatch: ${input.parentRunId}`);
    }

    if (sourceRun.status !== "WAITING_FOR_APPROVAL" || !sourceRun.interruption) {
      throw new Error(
        `Admin agent branch source must be waiting for approval: ${input.parentRunId}`,
      );
    }

    return sourceRun;
  }

  private async requireResumeRun(input: ResumeAdminAgentWorkflowRunnerInput) {
    const run = await this.adminAgentRepository.findRunByThreadId(input.threadId);

    if (!run) {
      throw new Error(`Admin agent workflow thread not found: ${input.threadId}`);
    }

    if (run.workflowName !== input.workflowName) {
      throw new Error(`Admin agent workflow thread mismatch: ${input.threadId}`);
    }

    if (run.status !== "WAITING_FOR_APPROVAL" || !run.interruption) {
      throw new Error(`Admin agent workflow thread is not waiting for approval: ${input.threadId}`);
    }

    return run;
  }

  private parseGenericApprovalResume(input: ResumeAdminAgentWorkflowRunnerInput) {
    try {
      return toGenericApprovalResume(input.resume);
    } catch (error) {
      throw new AdminAgentWorkflowInvalidResumeError(
        input.workflowName,
        toAdminAgentWorkflowFailureMessage(error),
        error,
      );
    }
  }

  private authorizeGenericApprovalResumeForRun(
    workflowName: ResumeAdminAgentWorkflowRunnerInput["workflowName"],
    resume: GenericApprovalResume,
    run: AdminAgentRun,
  ) {
    const interruption = toStoredGenericApprovalInterruption(run.interruption);

    if (!interruption) {
      throw new AdminAgentWorkflowInvalidResumeError(
        workflowName,
        "Admin agent workflow is not waiting for a generic approval.",
        null,
      );
    }

    try {
      return authorizeGenericApprovalResumePayload(resume, interruption);
    } catch (error) {
      throw new AdminAgentWorkflowInvalidResumeError(
        workflowName,
        toAdminAgentWorkflowFailureMessage(error),
        error,
      );
    }
  }

  private markWorkflowNodeStarted(
    runId: string,
    node: AdminAgentWorkflowNode,
    payload?: Record<string, unknown>,
  ) {
    return this.adminAgentRepository.markRunNode(runId, node, payload);
  }

  private async loadAuditLogs(state: AuditReviewWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "load_audit_logs");

    if (!this.listAdminOperationLogs) {
      throw new AdminAgentWorkflowConfigurationError(
        "Audit review workflow requires ListAdminOperationLogsUseCase.",
      );
    }

    const result = await this.listAdminOperationLogs.execute({
      action: normalizeOptionalStringInput(state.input.action),
      actorLogin: normalizeOptionalStringInput(state.input.actorLogin),
      page: 1,
      pageSize: auditReviewLimit,
      search: normalizeOptionalStringInput(state.input.search),
    });

    return { logs: result.data };
  }

  private async planMultiTask(state: MultiTaskOrchestrationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "plan_multi_task");

    const explicitPlan = normalizeMultiTaskPlan(state.input);

    if (explicitPlan.length > 0) {
      return {
        plan: explicitPlan,
        summary: `已按结构化输入规划 ${explicitPlan.length} 个 Agent 业务处理。`,
      };
    }

    const response = await this.chatCompletionClient.complete({
      signal: this.execution.getStore()?.signal,
      maxCompletionTokens: 1200,
      messages: buildMultiTaskPlanMessages(state.input),
      temperature: 0.1,
    });

    return parseMultiTaskPlanResponse(response);
  }

  private async runChildTasks(state: MultiTaskOrchestrationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "run_child_tasks", {
      taskCount: state.plan.length,
    });

    if (state.approval && !isGenericApprovalApproved(state.approval)) {
      return {
        childResults: [],
        summary: `${state.summary || "多任务编排计划已生成。"}\n管理员选择暂不启动子任务。`,
      };
    }

    const childResults = await runAdminAgentMultiTaskChildren({
      listRunsPageSize: multiTaskChildRunLookupLimit,
      parentRunId: state.runId,
      plan: state.plan,
      repository: this.adminAgentRepository,
      startChildWorkflow: async (input) => {
        this.execution.getStore()?.signal.throwIfAborted();
        const parent = await this.adminAgentRepository.findRunById(state.runId);
        if (parent?.status === "CANCELLED") throw new DOMException("Task cancelled", "AbortError");
        return this.startWorkflow(input);
      },
      startedByUserId: state.startedByUserId,
    });

    return { childResults };
  }

  private async loadArticles(state: ArticleAssistanceWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "load_articles");

    if (!this.listAdminArticles) {
      throw new AdminAgentWorkflowConfigurationError(
        "Article assistance workflow requires ListAdminArticlesUseCase.",
      );
    }

    const [articlesPage, article] = await Promise.all([
      this.listAdminArticles.execute({
        page: 1,
        pageSize: articleAssistanceLimit,
        search: normalizeOptionalStringInput(state.input.search),
        status: normalizeOptionalStringInput(state.input.status),
      }),
      this.loadArticleAssistanceDetail(state.input.articleId),
    ]);

    return {
      article,
      articles: articlesPage.data,
    };
  }

  private async loadSiteConfig(state: SiteConfigReviewWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "load_site_config");

    if (!this.getAdminSiteConfig) {
      throw new AdminAgentWorkflowConfigurationError(
        "Site config review workflow requires GetAdminSiteConfigUseCase.",
      );
    }

    const result = await this.getAdminSiteConfig.execute();
    return {
      siteConfig: {
        ...result,
        announcements: result.announcements.map((item) => ({
          id: item.id,
          key: item.key,
          title: item.title,
          icon: item.icon,
          iconClassName: item.iconClassName,
          process: item.process,
          status: item.status,
          command: item.command,
          output: item.output,
          isEnabled: item.isEnabled,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      },
    };
  }

  private async loadArticleAssistanceDetail(articleId: unknown) {
    const normalizedArticleId = normalizeOptionalStringInput(articleId);

    if (!normalizedArticleId) {
      return null;
    }

    if (!this.getAdminArticleById) {
      throw new AdminAgentWorkflowConfigurationError(
        "Article assistance workflow requires GetAdminArticleByIdUseCase.",
      );
    }

    return this.getAdminArticleById.execute(normalizedArticleId);
  }

  private async analyzeAuditLogs(state: AuditReviewWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "analyze_audit_logs", {
      auditLogCount: state.logs.length,
    });

    if (state.logs.length === 0) {
      return createEmptyAuditReviewAnalysisResult();
    }

    const response = await this.chatCompletionClient.complete({
      signal: this.execution.getStore()?.signal,
      maxCompletionTokens: 1600,
      messages: buildAuditReviewMessages(state.logs),
      temperature: 0.1,
    });

    return parseAuditReviewResponse(response, state.logs.length);
  }

  private async analyzeArticles(state: ArticleAssistanceWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "analyze_articles", {
      articleCount: state.articles.length,
      detailArticleId: state.article?.id ?? null,
    });

    if (state.articles.length === 0 && !state.article) {
      return createEmptyArticleAssistanceAnalysisResult();
    }

    const response = await this.chatCompletionClient.complete({
      signal: this.execution.getStore()?.signal,
      maxCompletionTokens: 1800,
      messages: buildArticleAssistanceMessages({
        article: state.article,
        articles: state.articles,
        input: state.input,
      }),
      temperature: 0.1,
    });

    return parseArticleAssistanceResponse(response, {
      article: state.article,
      articles: state.articles,
      input: state.input,
    });
  }

  private async analyzeSiteConfig(state: SiteConfigReviewWorkflowState) {
    const siteConfig = requireSiteConfigSnapshot(state.siteConfig);
    await this.markWorkflowNodeStarted(state.runId, "analyze_site_config", {
      announcementCount: siteConfig.announcements.length,
      navigationItemCount: siteConfig.settings.navigationItems.length,
      socialLinkCount: siteConfig.settings.socialLinks.length,
    });

    const response = await this.chatCompletionClient.complete({
      signal: this.execution.getStore()?.signal,
      maxCompletionTokens: 1600,
      messages: buildSiteConfigReviewMessages({
        input: state.input,
        siteConfig,
      }),
      temperature: 0.1,
    });

    return parseSiteConfigReviewResponse(response, siteConfig);
  }

  private async completeArticleAssistance(state: ArticleAssistanceWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "complete_article_assistance");

    const result = createArticleAssistanceCompletionResult({
      approval: state.approval,
      articleCount: state.articles.length,
      detailArticleId: state.article?.id ?? null,
      output: state.output,
      summary: state.summary,
    });
    await this.adminAgentRepository.completeRun(state.runId, result.summary, result.output);

    return result;
  }

  private async completeAuditReview(state: AuditReviewWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "complete_audit_review");

    const result = createAuditReviewCompletionResult({
      approval: state.approval,
      logCount: state.logs.length,
      output: state.output,
      summary: state.summary,
    });
    await this.adminAgentRepository.completeRun(state.runId, result.summary, result.output);

    return result;
  }

  private async completeSiteConfigReview(state: SiteConfigReviewWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "complete_site_config_review");

    const siteConfig = requireSiteConfigSnapshot(state.siteConfig);
    const actionResult = await executeAdminAgentGenericApprovalAction({
      actionExecutor: this.workflowActionExecutor,
      approval: state.approval,
      repository: this.adminAgentRepository,
      runId: state.runId,
    });
    const result = createSiteConfigReviewCompletionResult({
      actionResult,
      approval: state.approval,
      output: state.output,
      siteConfig,
      summary: state.summary,
    });
    await this.adminAgentRepository.completeRun(state.runId, result.summary, result.output);

    return result;
  }

  private async completeMultiTask(state: MultiTaskOrchestrationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "complete_multi_task");

    const result = createMultiTaskCompletionResult({
      childResults: state.childResults,
      plan: state.plan,
      summary: state.summary,
    });
    await this.adminAgentRepository.completeRun(state.runId, result.summary, result.output);

    return result;
  }

  private async loadComments(state: CommentModerationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "load_comments");

    const selectedCommentIds = normalizeCommentIds(state.input.commentIds);

    if (selectedCommentIds.length > 0) {
      if (!this.commentSelectionReader) {
        throw new AdminAgentWorkflowConfigurationError(
          "Comment selection reader is not configured.",
        );
      }

      const comments = await this.commentSelectionReader.listVisibleCommentsByIdsForAnalysis({
        ids: selectedCommentIds,
      });

      return { comments, scope: "selection" as const };
    }

    const { todayEnd, todayStart } = createLocalDayRange(new Date());
    const todayComments = await this.adminAgentRepository.listTodayVisibleCommentsForAnalysis({
      limit: commentAnalysisLimit,
      todayEnd,
      todayStart,
    });
    const scope: AdminAgentCommentAnalysisScope =
      todayComments.length > 0 ? "today" : "recentVisibleFallback";
    const comments =
      todayComments.length > 0
        ? todayComments
        : await this.adminAgentRepository.listRecentVisibleCommentsForAnalysis({
            limit: commentAnalysisLimit,
          });

    return { comments, scope };
  }

  private async analyzeComments(state: CommentModerationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "analyze_comments", {
      commentCount: state.comments.length,
      scope: state.scope,
    });

    if (state.comments.length === 0) {
      return {
        summary:
          state.scope === "today"
            ? "今日暂无可见评论，未生成评论治理建议。"
            : "暂无可用于分析的可见评论，未生成评论治理建议。",
      };
    }

    const response = await this.chatCompletionClient.complete({
      signal: this.execution.getStore()?.signal,
      maxCompletionTokens: 2000,
      messages: buildCommentAnalysisMessages({
        comments: state.comments,
        scope: state.scope,
      }),
      temperature: 0.1,
    });
    const analysis = parseCommentAnalysisResponse(response, state.comments);

    return {
      findings: analysis.findings,
      summary: analysis.summary,
    };
  }

  private async persistFindings(state: CommentModerationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "persist_findings", {
      proposedFindingCount: state.findings.length,
    });

    if (state.findings.length === 0) {
      return { findings: [] };
    }

    const existingPendingFindings = await this.adminAgentRepository.listPendingFindingsByTargetIds(
      state.findings.map((finding) => finding.targetId),
    );
    const existingPendingTargetIds = new Set(
      existingPendingFindings.map((finding) => finding.targetId),
    );
    const drafts = state.findings
      .filter((finding) => !existingPendingTargetIds.has(finding.targetId))
      .map(toFindingDraft);
    const createdFindings = await this.adminAgentRepository.createFindings(state.runId, drafts);
    const persistedFindingsByTargetId = new Map(
      [...existingPendingFindings, ...createdFindings].map((finding) => [
        finding.targetId,
        finding,
      ]),
    );

    return { findings: [...persistedFindingsByTargetId.values()] };
  }

  private async complete(state: CommentModerationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "complete");

    const result = createCommentModerationCompletionResult({
      actionResult: state.actionResult,
      analyzedCount: state.comments.length,
      findings: state.findings,
      scope: state.scope,
      summary: state.summary,
    });

    await this.adminAgentRepository.completeRun(state.runId, result.summary, result.output);

    return result;
  }
}

function normalizeOptionalStringInput(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : undefined;
}

function normalizeCommentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.flatMap((item) => {
        const id = typeof item === "string" ? item.trim() : "";
        return id ? [id] : [];
      }),
    ),
  ].slice(0, commentAnalysisLimit);
}

function isRetryableWorkflowError(error: unknown) {
  if (error instanceof AdminAgentWorkflowConfigurationError) {
    return false;
  }

  if (!error || typeof error !== "object") {
    return true;
  }

  const errorRecord = error as {
    code?: unknown;
    error?: { code?: unknown };
    message?: unknown;
    name?: unknown;
    response?: { status?: unknown };
    status?: unknown;
  };
  const message = typeof errorRecord.message === "string" ? errorRecord.message : "";
  const name = typeof errorRecord.name === "string" ? errorRecord.name : "";
  const status = errorRecord.response?.status ?? errorRecord.status;

  if (message.startsWith("Cancel") || message.startsWith("AbortError") || name === "AbortError") {
    return false;
  }

  if (name === "GraphValueError" || errorRecord.code === "ECONNABORTED") {
    return false;
  }

  if (typeof status === "number" && nonRetryableHttpStatuses.has(status)) {
    return false;
  }

  if (typeof status === "string" && nonRetryableHttpStatuses.has(Number(status))) {
    return false;
  }

  return errorRecord.error?.code !== "insufficient_quota";
}

class AdminAgentWorkflowConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAgentWorkflowConfigurationError";
  }
}

function requireSiteConfigSnapshot(siteConfig: AdminSiteConfigSnapshot | null) {
  if (!siteConfig) {
    throw new Error("Site config review state is missing site config snapshot.");
  }

  return siteConfig;
}

function toFindingDraft(finding: AdminAgentFinding): AdminAgentFindingDraft {
  return {
    category: finding.category,
    confidence: finding.confidence,
    evidence: finding.evidence,
    proposedAction: finding.proposedAction,
    reason: finding.reason,
    severity: finding.severity,
    targetId: finding.targetId,
    targetType: finding.targetType,
  };
}

function assertAdminAgentWorkflowRuntimeCatalog(runtimeCatalog: Record<string, unknown>) {
  const expectedWorkflowNames = listAdminAgentWorkflowMetadata().map(
    (metadata) => metadata.workflowName,
  );
  const actualWorkflowNames = Object.keys(runtimeCatalog);
  const missingWorkflowNames = expectedWorkflowNames.filter(
    (workflowName) => !actualWorkflowNames.includes(workflowName),
  );
  const extraWorkflowNames = actualWorkflowNames.filter(
    (workflowName) => !expectedWorkflowNames.some((expected) => expected === workflowName),
  );

  if (missingWorkflowNames.length > 0 || extraWorkflowNames.length > 0) {
    throw new Error(
      [
        "Admin agent workflow runtime catalog is out of sync with workflow metadata.",
        missingWorkflowNames.length > 0 ? `Missing: ${missingWorkflowNames.join(", ")}.` : null,
        extraWorkflowNames.length > 0 ? `Unexpected: ${extraWorkflowNames.join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

export { assertAdminAgentWorkflowRuntimeCatalog };

export { PiAdminAgentWorkflowRunner };
