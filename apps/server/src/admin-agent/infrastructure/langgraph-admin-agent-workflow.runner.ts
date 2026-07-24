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
import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  interrupt,
  isGraphInterrupt,
} from "@langchain/langgraph";
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
  createCommentModerationApprovalInterruption,
  createGenericApprovalInterruption,
  isGenericApprovalApproved,
  shouldRequestGenericApproval,
  toCommentModerationApprovalInterruptionFromGraphResult,
  toCommentModerationApprovalResume,
  toGenericApprovalInterruptionFromGraphResult,
  toGenericApprovalResume,
  toStoredCommentModerationApprovalInterruption,
  toStoredGenericApprovalInterruption,
  type AdminAgentGenericApprovalInterruption,
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
  toMultiTaskPlanFromOutput,
  toMultiTaskPlanSummaryFromOutput,
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
  createCommentModerationApprovalUpdate,
  createCommentModerationCompletionResult,
  type AdminAgentCommentModerationWorkflowRawResult,
  type AdminAgentCommentModerationWorkflowResult,
  toAdminAgentWorkflowFailureMessage,
  toAdminAgentWorkflowOutputRecord,
  toCommentModerationScope,
  toCommentModerationWorkflowResult,
  toCommentModerationWorkflowOutput,
  toGenericApprovalWorkflowCompletedResult,
  toGenericApprovalWorkflowInterruptedResult,
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
import { executeCommentModerationApprovalAction } from "../application/execute-comment-moderation-approval-action";
import { executeAdminAgentGenericApprovalAction } from "../application/execute-admin-agent-generic-approval-action";
import { OpenAiCompatibleChatCompletionClient } from "./ai/openai-compatible-chat-completion.client";
import {
  createLangGraphAdminAgentCheckpointHandle,
  type LangGraphAdminAgentCheckpointHandle,
  type LangGraphAdminAgentCheckpointOptions,
} from "./langgraph-admin-agent-checkpoint.manager";

type CommentModerationWorkflowState = typeof CommentModerationWorkflowAnnotation.State;
type ArticleAssistanceWorkflowState = typeof ArticleAssistanceWorkflowAnnotation.State;
type AuditReviewWorkflowState = typeof AuditReviewWorkflowAnnotation.State;
type MultiTaskOrchestrationWorkflowState = typeof MultiTaskOrchestrationWorkflowAnnotation.State;
type SiteConfigReviewWorkflowState = typeof SiteConfigReviewWorkflowAnnotation.State;
type GenericApprovalInterruption = AdminAgentGenericApprovalInterruption;
type AdminSiteConfigSnapshot = Awaited<ReturnType<GetAdminSiteConfigUseCase["execute"]>>;

type LangGraphAdminAgentWorkflowRunnerOptions = LangGraphAdminAgentCheckpointOptions;

type GenericApprovalWorkflowResult = {
  __interrupt__?: Array<{ value?: unknown }>;
  output?: Record<string, unknown>;
  summary?: string;
};
type LangGraphWorkflowConfig = {
  configurable: {
    checkpoint_id?: string;
    checkpoint_ns?: string;
    thread_id: string;
  };
};
type AdminAgentWorkflowRuntime = {
  branch: (input: BranchAdminAgentWorkflowRunnerInput) => Promise<AdminAgentWorkflowResult>;
  refresh: (input: RefreshAdminAgentWorkflowRunnerInput) => Promise<AdminAgentWorkflowResult>;
  resume: (input: ResumeAdminAgentWorkflowRunnerInput) => Promise<AdminAgentWorkflowResult>;
  start: (input: StartAdminAgentWorkflowRunnerInput) => Promise<AdminAgentWorkflowResult>;
};
type LangGraphWorkflowSnapshot<TState extends Record<string, unknown>> = {
  config: LangGraphWorkflowConfig;
  next: string[];
  values: TState;
};
type BranchableWorkflowGraph<TState extends Record<string, unknown>> = {
  getState(config: LangGraphWorkflowConfig): Promise<LangGraphWorkflowSnapshot<TState>>;
  invoke(input: unknown, config: LangGraphWorkflowConfig): Promise<TState>;
  updateState(
    config: LangGraphWorkflowConfig,
    values: Record<string, unknown>,
    asNode?: string,
  ): Promise<LangGraphWorkflowConfig>;
};
type GenericApprovalWorkflowGraph = BranchableWorkflowGraph<GenericApprovalWorkflowResult> & {
  invoke(input: unknown, config: LangGraphWorkflowConfig): Promise<GenericApprovalWorkflowResult>;
};

function createLangGraphThreadConfig(threadId: string): LangGraphWorkflowConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

type StartCommentModerationWorkflowResult = AdminAgentCommentModerationWorkflowResult;

const commentAnalysisLimit = 50;
const articleAssistanceLimit = 20;
const auditReviewLimit = 30;
const multiTaskChildRunLookupLimit = 50;
const nonRetryableHttpStatuses = new Set([400, 401, 402, 403, 404, 405, 406, 407, 409]);
const transientWorkflowRetryPolicy = {
  backoffFactor: 2,
  initialInterval: 0.05,
  jitter: false,
  logWarning: false,
  maxAttempts: 3,
  maxInterval: 0.2,
  retryOn: isRetryableWorkflowError,
};
const articleAssistanceWorkflowName = "ARTICLE_ASSISTANCE";
const commentModerationWorkflowName = "COMMENT_MODERATION_ANALYSIS";
const auditReviewWorkflowName = "AUDIT_REVIEW";
const multiTaskOrchestrationWorkflowName = "MULTI_TASK_ORCHESTRATION";
const siteConfigReviewWorkflowName = "SITE_CONFIG_REVIEW";

const CommentModerationWorkflowAnnotation = Annotation.Root({
  actionResult: Annotation<AdminAgentWorkflowActionExecutionResult | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  approval: Annotation<CommentModerationApprovalResume | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  comments: Annotation<AdminAgentCommentForAnalysis[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  findings: Annotation<AdminAgentFinding[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  input: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  runId: Annotation<string>(),
  scope: Annotation<AdminAgentCommentAnalysisScope>({
    default: () => "today",
    reducer: (_left, right) => right,
  }),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_left, right) => right,
  }),
});

const ArticleAssistanceWorkflowAnnotation = Annotation.Root({
  approval: Annotation<GenericApprovalResume | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  article: Annotation<AdminArticleDetail | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  articles: Annotation<AdminArticleListItem[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  input: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  output: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  runId: Annotation<string>(),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_left, right) => right,
  }),
});

const AuditReviewWorkflowAnnotation = Annotation.Root({
  approval: Annotation<GenericApprovalResume | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  input: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  logs: Annotation<AdminOperationLog[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  output: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  runId: Annotation<string>(),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_left, right) => right,
  }),
});

const MultiTaskOrchestrationWorkflowAnnotation = Annotation.Root({
  approval: Annotation<GenericApprovalResume | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  childResults: Annotation<MultiTaskChildResult[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  input: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  output: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  plan: Annotation<MultiTaskPlanItem[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  runId: Annotation<string>(),
  startedByUserId: Annotation<string | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_left, right) => right,
  }),
});

const SiteConfigReviewWorkflowAnnotation = Annotation.Root({
  approval: Annotation<GenericApprovalResume | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  input: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  output: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (_left, right) => right,
  }),
  runId: Annotation<string>(),
  siteConfig: Annotation<AdminSiteConfigSnapshot | null>({
    default: () => null,
    reducer: (_left, right) => right,
  }),
  summary: Annotation<string>({
    default: () => "",
    reducer: (_left, right) => right,
  }),
});

@Injectable()
class LangGraphAdminAgentWorkflowRunner
  implements AdminAgentWorkflowRunner, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LangGraphAdminAgentWorkflowRunner.name);
  @Inject(ADMIN_AGENT_COMMENT_SELECTION_READER)
  private readonly commentSelectionReader?: AdminAgentCommentSelectionReader;
  private readonly articleAssistanceGraph: ReturnType<
    LangGraphAdminAgentWorkflowRunner["createArticleAssistanceGraph"]
  >;
  private readonly auditReviewGraph: ReturnType<
    LangGraphAdminAgentWorkflowRunner["createAuditReviewGraph"]
  >;
  private readonly commentModerationGraph: ReturnType<
    LangGraphAdminAgentWorkflowRunner["createCommentModerationGraph"]
  >;
  private readonly multiTaskOrchestrationGraph: ReturnType<
    LangGraphAdminAgentWorkflowRunner["createMultiTaskOrchestrationGraph"]
  >;
  private readonly siteConfigReviewGraph: ReturnType<
    LangGraphAdminAgentWorkflowRunner["createSiteConfigReviewGraph"]
  >;
  private readonly checkpointer: unknown;
  private readonly checkpointHandle: LangGraphAdminAgentCheckpointHandle;
  private readonly workflowRuntimes: Record<
    AdminAgentRun["workflowName"],
    AdminAgentWorkflowRuntime
  >;

  constructor(
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
    @Inject(ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR)
    private readonly workflowActionExecutor: AdminAgentWorkflowActionExecutor,
    private readonly chatCompletionClient: OpenAiCompatibleChatCompletionClient,
    configService: ConfigService,
    @Optional()
    private readonly listAdminOperationLogs?: ListAdminOperationLogsUseCase,
    @Optional()
    private readonly getAdminSiteConfig?: GetAdminSiteConfigUseCase,
    @Optional()
    private readonly listAdminArticles?: ListAdminArticlesUseCase,
    @Optional()
    private readonly getAdminArticleById?: GetAdminArticleByIdUseCase,
    @Optional()
    options: LangGraphAdminAgentWorkflowRunnerOptions = {},
  ) {
    this.checkpointHandle = createLangGraphAdminAgentCheckpointHandle(configService, options);
    this.checkpointer = this.checkpointHandle.checkpointer;

    this.articleAssistanceGraph = this.createArticleAssistanceGraph();
    this.auditReviewGraph = this.createAuditReviewGraph();
    this.commentModerationGraph = this.createCommentModerationGraph();
    this.multiTaskOrchestrationGraph = this.createMultiTaskOrchestrationGraph();
    this.siteConfigReviewGraph = this.createSiteConfigReviewGraph();
    this.workflowRuntimes = this.createWorkflowRuntimes();
    assertAdminAgentWorkflowRuntimeCatalog(this.workflowRuntimes);
  }

  async onModuleInit() {
    await this.checkpointHandle.setup();
  }

  async onModuleDestroy() {
    await this.checkpointHandle.dispose();
  }

  async startWorkflow(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    this.assertStartWorkflowInput(input);
    return this.getWorkflowRuntime(input.workflowName).start(input);
  }

  async branchWorkflow(
    input: BranchAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.getWorkflowRuntime(input.workflowName).branch(input);
  }

  async refreshWorkflow(
    input: RefreshAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.getWorkflowRuntime(input.workflowName).refresh(input);
  }

  async resumeWorkflow(
    input: ResumeAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.getWorkflowRuntime(input.workflowName).resume(input);
  }

  private getWorkflowRuntime(
    workflowName: AdminAgentRun["workflowName"],
  ): AdminAgentWorkflowRuntime {
    return this.workflowRuntimes[workflowName];
  }

  private createWorkflowRuntimes(): Record<
    AdminAgentRun["workflowName"],
    AdminAgentWorkflowRuntime
  > {
    const genericBranch = (graph: GenericApprovalWorkflowGraph) => {
      return (input: BranchAdminAgentWorkflowRunnerInput) =>
        this.branchGenericApprovalWorkflow(input, graph);
    };

    return {
      [articleAssistanceWorkflowName]: {
        branch: genericBranch(
          this.articleAssistanceGraph as unknown as GenericApprovalWorkflowGraph,
        ),
        refresh: (input) => this.refreshUnsupportedWorkflow(input),
        resume: (input) => this.resumeArticleAssistance(input),
        start: (input) => this.startArticleAssistance(input),
      },
      [auditReviewWorkflowName]: {
        branch: genericBranch(this.auditReviewGraph as unknown as GenericApprovalWorkflowGraph),
        refresh: (input) => this.refreshUnsupportedWorkflow(input),
        resume: (input) => this.resumeAuditReview(input),
        start: (input) => this.startAuditReview(input),
      },
      [commentModerationWorkflowName]: {
        branch: (input) => this.branchCommentModerationAnalysis(input),
        refresh: (input) => this.refreshUnsupportedWorkflow(input),
        resume: (input) => this.resumeCommentModerationAnalysis(input),
        start: (input) => this.startCommentModerationAnalysis(input),
      },
      [multiTaskOrchestrationWorkflowName]: {
        branch: genericBranch(
          this.multiTaskOrchestrationGraph as unknown as GenericApprovalWorkflowGraph,
        ),
        refresh: (input) => this.refreshMultiTaskOrchestration(input),
        resume: (input) => this.resumeMultiTaskOrchestration(input),
        start: (input) => this.startMultiTaskOrchestration(input),
      },
      [siteConfigReviewWorkflowName]: {
        branch: genericBranch(
          this.siteConfigReviewGraph as unknown as GenericApprovalWorkflowGraph,
        ),
        refresh: (input) => this.refreshUnsupportedWorkflow(input),
        resume: (input) => this.resumeSiteConfigReview(input),
        start: (input) => this.startSiteConfigReview(input),
      },
    };
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

  private async branchCommentModerationAnalysis(
    input: BranchAdminAgentWorkflowRunnerInput,
  ): Promise<StartCommentModerationWorkflowResult> {
    const sourceRun = await this.requireBranchSourceRun(input);
    const graph = this.commentModerationGraph as unknown as BranchableWorkflowGraph<
      CommentModerationWorkflowState & GenericApprovalWorkflowResult
    >;
    const snapshot = await graph.getState(createLangGraphThreadConfig(input.sourceThreadId));
    const snapshotValues = toSnapshotValues(snapshot.values);
    const runId = randomUUID();
    const branchRun = await this.createBranchRun(input, sourceRun, runId);
    await graph.updateState(createLangGraphThreadConfig(runId), {
      ...snapshotValues,
      runId,
    });
    const result = await this.invokeGraphOrFail(branchRun.id, () =>
      graph.invoke(null, createLangGraphThreadConfig(runId)),
    );
    const interruption =
      toCommentModerationApprovalInterruptionFromGraphResult(result) ??
      toStoredCommentModerationApprovalInterruption(sourceRun.interruption);

    if (!interruption) {
      throw new Error(`Admin agent task cannot branch without comment approval: ${sourceRun.id}`);
    }

    const waitingRun = await this.adminAgentRepository.markRunInterrupted(
      branchRun.id,
      interruption,
      sourceRun.summary || interruption.summary,
      { approvalNode: toAdminAgentWorkflowApprovalNode(sourceRun.workflowName) },
    );

    return toCommentModerationWorkflowResult({
      interruption,
      result,
      run: waitingRun,
      summaryFallback: interruption.summary,
    });
  }

  private async branchGenericApprovalWorkflow(
    input: BranchAdminAgentWorkflowRunnerInput,
    graph: GenericApprovalWorkflowGraph,
  ): Promise<AdminAgentWorkflowResult> {
    const sourceRun = await this.requireBranchSourceRun(input);
    const snapshot = await graph.getState(createLangGraphThreadConfig(input.sourceThreadId));
    const snapshotValues = toSnapshotValues(snapshot.values);
    const runId = randomUUID();
    const branchRun = await this.createBranchRun(input, sourceRun, runId);
    await graph.updateState(createLangGraphThreadConfig(runId), {
      ...snapshotValues,
      runId,
    });
    const result = await this.invokeGraphOrFail(branchRun.id, () =>
      graph.invoke(null, createLangGraphThreadConfig(runId)),
    );
    const interruption =
      toGenericApprovalInterruptionFromGraphResult(result) ??
      toStoredGenericApprovalInterruption(sourceRun.interruption);

    if (!interruption) {
      throw new Error(`Admin agent task cannot branch without approval: ${sourceRun.id}`);
    }

    const waitingRun = await this.adminAgentRepository.markRunInterrupted(
      branchRun.id,
      interruption,
      sourceRun.summary || interruption.summary,
      { approvalNode: toAdminAgentWorkflowApprovalNode(sourceRun.workflowName) },
    );

    return toGenericApprovalWorkflowInterruptedResult(result, waitingRun, interruption);
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

  private createBranchRun(
    input: BranchAdminAgentWorkflowRunnerInput,
    sourceRun: AdminAgentRun,
    runId: string,
  ) {
    return this.adminAgentRepository.createRun(
      createAdminAgentWorkflowBranchRunInput(
        {
          sourceRun,
          sourceThreadId: input.sourceThreadId,
          startedByUserId: input.startedByUserId,
        },
        { runId },
      ),
    );
  }

  private async startCommentModerationAnalysis(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<StartCommentModerationWorkflowResult> {
    const runId = randomUUID();
    const run = await this.adminAgentRepository.createRun(
      createAdminAgentWorkflowRunInput(input, { runId }),
    );
    const threadId = run.threadId ?? run.id;
    await this.adminAgentRepository.markRunRunning(run.id);

    const result = await this.invokeGraphOrFail(run.id, () =>
      this.commentModerationGraph.invoke(
        {
          input: input.input ?? {},
          runId: run.id,
        },
        createLangGraphThreadConfig(threadId),
      ),
    );
    const interruption = toCommentModerationApprovalInterruptionFromGraphResult(result);

    if (interruption) {
      const waitingRun = await this.adminAgentRepository.markRunInterrupted(
        run.id,
        interruption,
        `等待管理员确认 ${interruption.findingIds.length} 条评论治理建议。`,
        { approvalNode: toAdminAgentWorkflowApprovalNode(commentModerationWorkflowName) },
      );

      return toCommentModerationWorkflowResult({
        interruption,
        result,
        run: waitingRun,
      });
    }

    const completedRun = await this.completeCommentModerationRunIfNeeded(run.id, result);

    return toCommentModerationWorkflowResult({
      interruption: null,
      result,
      run: completedRun,
    });
  }

  private async startArticleAssistance(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.startGenericApprovalWorkflow(
      input,
      articleAssistanceWorkflowName,
      this.articleAssistanceGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private async startAuditReview(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.startGenericApprovalWorkflow(
      input,
      auditReviewWorkflowName,
      this.auditReviewGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private async startSiteConfigReview(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.startGenericApprovalWorkflow(
      input,
      siteConfigReviewWorkflowName,
      this.siteConfigReviewGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private async startMultiTaskOrchestration(
    input: StartAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    return this.startGenericApprovalWorkflow(
      input,
      multiTaskOrchestrationWorkflowName,
      this.multiTaskOrchestrationGraph as unknown as GenericApprovalWorkflowGraph,
      { startedByUserId: input.startedByUserId },
    );
  }

  private async refreshUnsupportedWorkflow(
    input: RefreshAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    throw new Error(`Admin agent workflow cannot be refreshed: ${input.workflowName}`);
  }

  private async refreshMultiTaskOrchestration(
    input: RefreshAdminAgentWorkflowRunnerInput,
  ): Promise<AdminAgentWorkflowResult> {
    const run = await this.adminAgentRepository.findRunById(input.runId);

    if (!run || run.workflowName !== multiTaskOrchestrationWorkflowName) {
      throw new Error(`Multi-task orchestration run not found: ${input.runId}`);
    }

    if (run.status !== "COMPLETED" && run.status !== "FAILED") {
      throw new Error(
        `Multi-task orchestration run cannot be refreshed while ${run.status}: ${input.runId}`,
      );
    }

    const { plan, summary } = await this.resolveMultiTaskRefreshPlan(run);
    await this.adminAgentRepository.markRunRunning(run.id, { resumed: true });
    await this.markWorkflowNodeStarted(run.id, "run_child_tasks", {
      refreshed: true,
      taskCount: plan.length,
    });

    const childResults = await runAdminAgentMultiTaskChildren({
      listRunsPageSize: multiTaskChildRunLookupLimit,
      parentRunId: run.id,
      plan,
      repository: this.adminAgentRepository,
      startChildWorkflow: (childInput) => this.startWorkflow(childInput),
      startedByUserId: input.startedByUserId,
    });

    await this.markWorkflowNodeStarted(run.id, "complete_multi_task", {
      refreshed: true,
      taskCount: childResults.length,
    });

    const result = createMultiTaskCompletionResult({
      childResults,
      plan,
      summary: summary || "多任务编排汇总已刷新。",
    });
    const completedRun = await this.adminAgentRepository.completeRun(
      run.id,
      result.summary,
      result.output,
    );

    return {
      interruption: null,
      output: result.output,
      run: completedRun,
      summary: result.summary,
    };
  }

  private async resolveMultiTaskRefreshPlan(run: AdminAgentRun) {
    const outputPlan = toMultiTaskPlanFromOutput(run.output);

    if (outputPlan.length > 0) {
      return {
        plan: outputPlan,
        summary: toMultiTaskPlanSummaryFromOutput(run.output),
      };
    }

    if (run.threadId) {
      const graph = this
        .multiTaskOrchestrationGraph as unknown as BranchableWorkflowGraph<MultiTaskOrchestrationWorkflowState>;
      const snapshot = await graph.getState(createLangGraphThreadConfig(run.threadId));
      const snapshotValues = toSnapshotValues(snapshot.values);
      const checkpointPlan = normalizeMultiTaskPlan({
        tasks: snapshotValues.plan,
      });

      if (checkpointPlan.length > 0) {
        return {
          plan: checkpointPlan,
          summary:
            typeof snapshotValues.summary === "string" ? snapshotValues.summary : run.summary || "",
        };
      }
    }

    return {
      plan: normalizeMultiTaskPlan(run.input ?? {}),
      summary: run.summary || "",
    };
  }

  private async startGenericApprovalWorkflow(
    input: StartAdminAgentWorkflowRunnerInput,
    workflowName: AdminAgentRun["workflowName"],
    graph: GenericApprovalWorkflowGraph,
    stateInput: Record<string, unknown> = {},
  ): Promise<AdminAgentWorkflowResult> {
    const runId = randomUUID();
    const run = await this.adminAgentRepository.createRun(
      createAdminAgentWorkflowRunInput(input, { runId }),
    );
    const threadId = run.threadId ?? run.id;
    await this.adminAgentRepository.markRunRunning(run.id);

    const result = await this.invokeGraphOrFail(run.id, () =>
      graph.invoke(
        {
          input: input.input ?? {},
          runId: run.id,
          ...stateInput,
        },
        createLangGraphThreadConfig(threadId),
      ),
    );
    const interruption = toGenericApprovalInterruptionFromGraphResult(result);

    if (interruption) {
      return this.interruptGenericWorkflowRun(run.id, workflowName, result, interruption);
    }

    const completedRun = await this.completeGenericApprovalRunIfNeeded(run.id, result);

    return toGenericApprovalWorkflowCompletedResult(result, completedRun);
  }

  private async resumeCommentModerationAnalysis(
    input: ResumeAdminAgentWorkflowRunnerInput,
  ): Promise<StartCommentModerationWorkflowResult> {
    const run = await this.requireResumeRun(input);

    const resume = this.parseCommentModerationResume(input);
    const resumeWithContext = {
      ...resume,
      actor: input.actor,
      requestContext: input.requestContext,
    };
    await this.adminAgentRepository.markRunRunning(run.id, { resumed: true });

    const result = await this.invokeGraphOrFail(run.id, () =>
      this.commentModerationGraph.invoke(
        new Command({
          resume: resumeWithContext,
        }),
        createLangGraphThreadConfig(input.threadId),
      ),
    );
    const interruption = toCommentModerationApprovalInterruptionFromGraphResult(result);

    if (interruption) {
      const waitingRun = await this.adminAgentRepository.markRunInterrupted(
        run.id,
        interruption,
        `等待管理员确认 ${interruption.findingIds.length} 条评论治理建议。`,
        { approvalNode: toAdminAgentWorkflowApprovalNode(commentModerationWorkflowName) },
      );

      return toCommentModerationWorkflowResult({
        interruption,
        result,
        run: waitingRun,
      });
    }

    const finalResult = await this.ensureCommentModerationApprovalApplied(
      run.id,
      result,
      resumeWithContext,
    );
    const completedRun = await this.completeCommentModerationRunIfNeeded(run.id, finalResult);

    return toCommentModerationWorkflowResult({
      interruption: null,
      result: finalResult,
      run: completedRun,
    });
  }

  private async ensureCommentModerationApprovalApplied(
    runId: string,
    result: AdminAgentCommentModerationWorkflowRawResult,
    approval: CommentModerationApprovalResume,
  ): Promise<AdminAgentCommentModerationWorkflowRawResult> {
    const run = await this.adminAgentRepository.findRunById(runId);

    if (!run) {
      throw new Error(`Admin agent workflow run disappeared: ${runId}`);
    }

    if (run.status === "COMPLETED" || result.actionResult || approval.decision !== "APPROVE") {
      return result;
    }

    const actionResult = await executeCommentModerationApprovalAction({
      actionExecutor: this.workflowActionExecutor,
      approval,
      repository: this.adminAgentRepository,
      runId,
    });
    const update = createCommentModerationApprovalUpdate({
      actionResult,
      approval,
      findingCount: result.findings?.length,
      summary: result.summary,
    });

    return {
      ...result,
      ...update,
    };
  }

  private async completeCommentModerationRunIfNeeded(
    runId: string,
    result: AdminAgentCommentModerationWorkflowRawResult,
  ) {
    const run = await this.adminAgentRepository.findRunById(runId);

    if (!run) {
      throw new Error(`Admin agent workflow run disappeared: ${runId}`);
    }

    if (run.status === "COMPLETED") {
      return run;
    }

    return this.adminAgentRepository.completeRun(
      runId,
      result.summary || "评论治理任务已完成。",
      toCommentModerationWorkflowOutput(
        result.findings ?? [],
        toCommentModerationScope(result.scope),
        result.actionResult ?? null,
        result.comments?.length ?? 0,
      ),
    );
  }

  private resumeArticleAssistance(input: ResumeAdminAgentWorkflowRunnerInput) {
    return this.resumeGenericApprovalWorkflow(
      input,
      this.articleAssistanceGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private resumeAuditReview(input: ResumeAdminAgentWorkflowRunnerInput) {
    return this.resumeGenericApprovalWorkflow(
      input,
      this.auditReviewGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private resumeSiteConfigReview(input: ResumeAdminAgentWorkflowRunnerInput) {
    return this.resumeGenericApprovalWorkflow(
      input,
      this.siteConfigReviewGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private resumeMultiTaskOrchestration(input: ResumeAdminAgentWorkflowRunnerInput) {
    return this.resumeGenericApprovalWorkflow(
      input,
      this.multiTaskOrchestrationGraph as unknown as GenericApprovalWorkflowGraph,
    );
  }

  private async resumeGenericApprovalWorkflow(
    input: ResumeAdminAgentWorkflowRunnerInput,
    graph: GenericApprovalWorkflowGraph,
  ): Promise<AdminAgentWorkflowResult> {
    const run = await this.requireResumeRun(input);

    const resume = this.parseGenericApprovalResume(input);
    const authorizedResume = this.authorizeGenericApprovalResumeForRun(
      input.workflowName,
      resume,
      run,
    );
    await this.adminAgentRepository.markRunRunning(run.id, { resumed: true });
    const result = await this.invokeGraphOrFail(run.id, () =>
      graph.invoke(
        new Command({
          resume: {
            ...authorizedResume,
            actor: input.actor,
            requestContext: input.requestContext,
          },
        }),
        createLangGraphThreadConfig(input.threadId),
      ),
    );
    const interruption = toGenericApprovalInterruptionFromGraphResult(result);

    if (interruption) {
      return this.interruptGenericWorkflowRun(run.id, run.workflowName, result, interruption);
    }

    const completedRun = await this.completeGenericApprovalRunIfNeeded(run.id, result);

    return toGenericApprovalWorkflowCompletedResult(result, completedRun);
  }

  private async completeGenericApprovalRunIfNeeded(
    runId: string,
    result: GenericApprovalWorkflowResult,
  ) {
    const run = await this.adminAgentRepository.findRunById(runId);

    if (!run) {
      throw new Error(`Admin agent workflow run disappeared: ${runId}`);
    }

    if (run.status === "COMPLETED") {
      return run;
    }

    return this.adminAgentRepository.completeRun(
      runId,
      result.summary || run.summary || "Agent 业务处理已完成。",
      toAdminAgentWorkflowOutputRecord(result.output),
    );
  }

  private createCommentModerationGraph() {
    return new StateGraph(CommentModerationWorkflowAnnotation)
      .addNode("load_comments", async (state) => this.loadComments(state))
      .addNode("analyze_comments", async (state) => this.analyzeComments(state))
      .addNode("persist_findings", async (state) => this.persistFindings(state))
      .addNode("complete", async (state) => this.complete(state))
      .addEdge(START, "load_comments")
      .addEdge("load_comments", "analyze_comments")
      .addEdge("analyze_comments", "persist_findings")
      .addEdge("persist_findings", "complete")
      .addEdge("complete", END)
      .setNodeDefaults({ retryPolicy: transientWorkflowRetryPolicy })
      .compile({
        checkpointer: this.checkpointer as never,
      });
  }

  private async invokeGraphOrFail<T>(runId: string, invoke: () => Promise<T>) {
    try {
      return await invoke();
    } catch (error) {
      if (isGraphInterrupt(error)) {
        return {
          __interrupt__: error.interrupts,
        } as T;
      }

      const message = toAdminAgentWorkflowFailureMessage(error);
      await this.adminAgentRepository.failRun(runId, message);
      throw new AdminAgentWorkflowExecutionError(runId, message, error);
    }
  }

  private parseCommentModerationResume(input: ResumeAdminAgentWorkflowRunnerInput) {
    try {
      return toCommentModerationApprovalResume(input.resume);
    } catch (error) {
      throw new AdminAgentWorkflowInvalidResumeError(
        input.workflowName,
        toAdminAgentWorkflowFailureMessage(error),
        error,
      );
    }
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

  private async interruptGenericWorkflowRun(
    runId: string,
    workflowName: AdminAgentRun["workflowName"],
    result: GenericApprovalWorkflowResult,
    interruption: GenericApprovalInterruption,
  ): Promise<AdminAgentWorkflowResult> {
    const waitingRun = await this.adminAgentRepository.markRunInterrupted(
      runId,
      interruption,
      interruption.summary,
      { approvalNode: toAdminAgentWorkflowApprovalNode(workflowName) },
    );

    return toGenericApprovalWorkflowInterruptedResult(result, waitingRun, interruption);
  }

  private createArticleAssistanceGraph() {
    return new StateGraph(ArticleAssistanceWorkflowAnnotation)
      .addNode("load_articles", async (state) => this.loadArticles(state))
      .addNode("analyze_articles", async (state) => this.analyzeArticles(state))
      .addNode("request_article_approval", async (state) =>
        this.requestGenericApproval(
          state,
          createArticleAssistanceApprovalRequest({
            detailArticleId: state.article?.id ?? null,
            output: state.output,
            summary: state.summary,
          }),
        ),
      )
      .addNode("complete_article_assistance", async (state) =>
        this.completeArticleAssistance(state),
      )
      .addEdge(START, "load_articles")
      .addEdge("load_articles", "analyze_articles")
      .addConditionalEdges("analyze_articles", (state) =>
        shouldRequestGenericApproval(state.input)
          ? "request_article_approval"
          : "complete_article_assistance",
      )
      .addEdge("request_article_approval", "complete_article_assistance")
      .addEdge("complete_article_assistance", END)
      .setNodeDefaults({ retryPolicy: transientWorkflowRetryPolicy })
      .compile({
        checkpointer: this.checkpointer as never,
      });
  }

  private createAuditReviewGraph() {
    return new StateGraph(AuditReviewWorkflowAnnotation)
      .addNode("load_audit_logs", async (state) => this.loadAuditLogs(state))
      .addNode("analyze_audit_logs", async (state) => this.analyzeAuditLogs(state))
      .addNode("request_audit_approval", async (state) =>
        this.requestGenericApproval(
          state,
          createAuditReviewApprovalRequest({
            logCount: state.logs.length,
            output: state.output,
            summary: state.summary,
          }),
        ),
      )
      .addNode("complete_audit_review", async (state) => this.completeAuditReview(state))
      .addEdge(START, "load_audit_logs")
      .addEdge("load_audit_logs", "analyze_audit_logs")
      .addConditionalEdges("analyze_audit_logs", (state) =>
        shouldRequestGenericApproval(state.input)
          ? "request_audit_approval"
          : "complete_audit_review",
      )
      .addEdge("request_audit_approval", "complete_audit_review")
      .addEdge("complete_audit_review", END)
      .setNodeDefaults({ retryPolicy: transientWorkflowRetryPolicy })
      .compile({
        checkpointer: this.checkpointer as never,
      });
  }

  private createMultiTaskOrchestrationGraph() {
    return new StateGraph(MultiTaskOrchestrationWorkflowAnnotation)
      .addNode("plan_multi_task", async (state) => this.planMultiTask(state))
      .addNode("request_multi_task_approval", async (state) =>
        this.requestGenericApproval(
          state,
          createMultiTaskApprovalRequest({
            plan: state.plan,
            summary: state.summary,
          }),
        ),
      )
      .addNode("run_child_tasks", async (state) => this.runChildTasks(state))
      .addNode("complete_multi_task", async (state) => this.completeMultiTask(state))
      .addEdge(START, "plan_multi_task")
      .addConditionalEdges("plan_multi_task", (state) =>
        shouldRequestGenericApproval(state.input) && state.plan.length > 0
          ? "request_multi_task_approval"
          : "run_child_tasks",
      )
      .addEdge("request_multi_task_approval", "run_child_tasks")
      .addEdge("run_child_tasks", "complete_multi_task")
      .addEdge("complete_multi_task", END)
      .setNodeDefaults({ retryPolicy: transientWorkflowRetryPolicy })
      .compile({
        checkpointer: this.checkpointer as never,
      });
  }

  private createSiteConfigReviewGraph() {
    return new StateGraph(SiteConfigReviewWorkflowAnnotation)
      .addNode("load_site_config", async (state) => this.loadSiteConfig(state))
      .addNode("analyze_site_config", async (state) => this.analyzeSiteConfig(state))
      .addNode("request_site_config_approval", async (state) => {
        const request = createSiteConfigApprovalRequest(state.input, state.output);

        return this.requestGenericApproval(state, {
          ...request,
          summary: state.summary || request.summary,
        });
      })
      .addNode("complete_site_config_review", async (state) => this.completeSiteConfigReview(state))
      .addEdge(START, "load_site_config")
      .addEdge("load_site_config", "analyze_site_config")
      .addConditionalEdges("analyze_site_config", (state) =>
        shouldRequestGenericApproval(state.input)
          ? "request_site_config_approval"
          : "complete_site_config_review",
      )
      .addEdge("request_site_config_approval", "complete_site_config_review")
      .addEdge("complete_site_config_review", END)
      .setNodeDefaults({ retryPolicy: transientWorkflowRetryPolicy })
      .compile({
        checkpointer: this.checkpointer as never,
      });
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
      startChildWorkflow: (input) => this.startWorkflow(input),
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

    return { siteConfig: await this.getAdminSiteConfig.execute() };
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

  private async requestGenericApproval<TState extends { runId: string }>(
    state: TState,
    request: AdminAgentGenericApprovalRequest,
  ) {
    // Do not write NODE_STARTED here: LangGraph replays code before interrupt() on resume.
    const approval = interrupt(
      createGenericApprovalInterruption({
        action: request.action,
        payload: request.payload,
        question: request.question,
        runId: state.runId,
        subject: request.subject,
        summary: request.summary,
      }),
    );

    return { approval: approval as GenericApprovalResume };
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

    // A review activity is bound to this run. Reusing a finding from another run
    // would render it under the new analysis ID, then make its moderation request
    // fail the ownership check.
    return { findings: createdFindings };
  }

  private async requestHumanApproval(state: CommentModerationWorkflowState) {
    const actionableFindings = state.findings.filter(
      (finding) => finding.status === "PENDING" && finding.proposedAction !== "NO_ACTION",
    );

    if (actionableFindings.length === 0) {
      return {};
    }

    const findingIds = actionableFindings.map((finding) => finding.id);
    // Do not write NODE_STARTED here: LangGraph replays code before interrupt() on resume.
    const approval = interrupt(
      createCommentModerationApprovalInterruption({
        findingIds,
        runId: state.runId,
        scope: state.scope,
      }),
    );

    return { approval: approval as CommentModerationApprovalResume };
  }

  private async applyApproval(state: CommentModerationWorkflowState) {
    await this.markWorkflowNodeStarted(state.runId, "apply_approval", {
      approvalDecision: state.approval?.decision ?? "NONE",
    });

    if (!state.approval || state.approval.decision === "DEFER") {
      return createCommentModerationApprovalUpdate({
        actionResult: null,
        approval: state.approval,
        findingCount: state.findings?.length,
        summary: state.summary,
      });
    }

    if (!state.approval.actor) {
      throw new Error("Admin agent workflow approval is missing actor context.");
    }

    const result = await executeCommentModerationApprovalAction({
      actionExecutor: this.workflowActionExecutor,
      approval: state.approval,
      repository: this.adminAgentRepository,
      runId: state.runId,
    });

    return createCommentModerationApprovalUpdate({
      actionResult: result,
      approval: state.approval,
      findingCount: state.findings?.length,
      summary: state.summary,
    });
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function toSnapshotValues(value: unknown): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new Error("Admin agent checkpoint state is not a record.");
  }

  return value;
}

export { LangGraphAdminAgentWorkflowRunner };

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
