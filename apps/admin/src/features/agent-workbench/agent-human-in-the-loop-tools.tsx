import type {
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskControlAction,
  AdminAgentTaskName,
  StartAdminAgentTaskResponse,
} from "@adrian-zephyr-notes/contracts";
import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import {
  CheckCircle2,
  HelpCircle,
  Loader2,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { controlAdminAgentTask, startAdminAgentTask } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import {
  AgentExecutionReceipt,
  summarizeExecutionResults,
  toExecutionSummaryText,
} from "./agent-execution-receipt";
import { executeAgentOperations, type ConfirmedOperationResult } from "./agent-operation-executor";
import {
  adminAgentId,
  askUserQuestionSchema,
  askUserQuestionToolName,
  controlAdminAgentTaskSchema,
  controlAdminAgentTaskToolName,
  startAdminAgentTaskSchema,
  startAdminAgentTaskToolName,
  type AskUserChoiceOperation,
  type AskUserQuestionArgs,
  type ControlAdminAgentTaskArgs,
  type StartAdminAgentTaskArgs,
} from "./agent-human-in-loop-contracts";
import { resolveChoiceOperations } from "./agent-question-operation-resolver";

type AgentHumanInLoopToolsProps = {
  agentTasks: AdminAgentTaskSummaryResponse[];
  home: AdminAgentHomeResponse | null;
  onOperationApplied: () => Promise<void>;
};

function AgentHumanInLoopTools({
  agentTasks,
  home,
  onOperationApplied,
}: AgentHumanInLoopToolsProps) {
  useHumanInTheLoop<AskUserQuestionArgs>(
    {
      agentId: adminAgentId,
      description:
        "Ask the admin a short multiple-choice question when you need their preference, scope, next-step decision, or approval for a paused Agent business action. If the admin's choice authorizes writes, include the exact agent_task_resume operation returned by the Agent approval request in that choice; the UI will execute it immediately when clicked. Do not ask for a second confirmation after the admin chooses an executable option.",
      name: askUserQuestionToolName,
      parameters: askUserQuestionSchema,
      render: (props) => <AskUserQuestionCard {...props} onOperationApplied={onOperationApplied} />,
    },
    [onOperationApplied],
  );

  useHumanInTheLoop<StartAdminAgentTaskArgs>(
    {
      agentId: adminAgentId,
      description:
        "Start a registered Agent business action. Use comment_moderation_analysis for comment analysis, article_assistance for article review and publishing guidance, site_config_review for site configuration review, audit_review for audit log analysis, and multi_task_orchestration when one admin request needs multiple business actions. If this tool returns an approval question, let the rendered confirmation card handle the admin choice; do not restate internal IDs, operation payloads, or ask for a second confirmation. Do not use it for greetings or generic chat. Only explain business actions, decisions, and outcomes to the admin.",
      name: startAdminAgentTaskToolName,
      parameters: startAdminAgentTaskSchema,
      render: (props) => (
        <StartAdminAgentTaskCard
          {...props}
          availableTasks={home?.tasks ?? []}
          onOperationApplied={onOperationApplied}
        />
      ),
    },
    [home?.tasks, onOperationApplied],
  );

  useHumanInTheLoop<ControlAdminAgentTaskArgs>(
    {
      agentId: adminAgentId,
      description:
        "Control an existing Agent business action. Use only actions listed in workspace.businessTaskContext.availableBusinessTasks.actions, and use only task IDs from workspace.businessTaskContext. When a business task exposes both sourceTaskId and latestAttemptTaskId, prefer latestAttemptTaskId; the UI will also resolve sourceTaskId to the latest retry attempt before executing. If the controlled action returns an approval question, let the rendered confirmation card handle the admin choice; do not restate internal IDs, operation payloads, or ask for a second confirmation. Only describe the business action, decision, and result to the admin.",
      name: controlAdminAgentTaskToolName,
      parameters: controlAdminAgentTaskSchema,
      render: (props) => (
        <ControlAdminAgentTaskCard
          {...props}
          agentTasks={agentTasks}
          availableTasks={home?.tasks ?? []}
          onOperationApplied={onOperationApplied}
        />
      ),
    },
    [agentTasks, home?.tasks, onOperationApplied],
  );

  return null;
}

type AskUserQuestionCardProps = {
  args: Partial<AskUserQuestionArgs> | AskUserQuestionArgs;
  onOperationApplied: () => Promise<void>;
  result: string | undefined;
  status: "inProgress" | "executing" | "complete";
  respond?: (result: unknown) => Promise<void>;
};

type StartAdminAgentTaskCardProps = {
  args: Partial<StartAdminAgentTaskArgs> | StartAdminAgentTaskArgs;
  availableTasks: AdminAgentHomeResponse["tasks"];
  onOperationApplied: () => Promise<void>;
  result: string | undefined;
  status: "inProgress" | "executing" | "complete";
  respond?: (result: unknown) => Promise<void>;
};

type ControlAdminAgentTaskCardProps = {
  args: Partial<ControlAdminAgentTaskArgs> | ControlAdminAgentTaskArgs;
  agentTasks: AdminAgentTaskSummaryResponse[];
  availableTasks: AdminAgentHomeResponse["tasks"];
  onOperationApplied: () => Promise<void>;
  result: string | undefined;
  status: "inProgress" | "executing" | "complete";
  respond?: (result: unknown) => Promise<void>;
};

type StartAdminAgentTaskToolResult = {
  approval?: QuestionToolResult;
  error?: string;
  events?: StartAdminAgentTaskResponse["events"];
  executed: boolean;
  findingCount?: number;
  interruption?: StartAdminAgentTaskResponse["interruption"];
  output?: StartAdminAgentTaskResponse["output"];
  reason?: string;
  task?: {
    id: string;
    status: StartAdminAgentTaskResponse["task"]["status"];
  };
  summary?: string;
  taskName?: AdminAgentTaskName;
};

type AdminAgentTaskApprovalInterruption = NonNullable<StartAdminAgentTaskResponse["interruption"]>;
type AdminAgentTaskApprovalOption = AdminAgentTaskApprovalInterruption["options"][number];

type ControlAdminAgentTaskToolResult = {
  action?: AdminAgentTaskControlAction;
  approval?: QuestionToolResult;
  effectiveTaskId?: string;
  error?: string;
  events?: StartAdminAgentTaskResponse["events"];
  executed: boolean;
  interruption?: StartAdminAgentTaskResponse["interruption"];
  reason?: string;
  task?: {
    id: string;
    status: StartAdminAgentTaskResponse["task"]["status"];
  };
  sourceTaskId?: string;
  summary?: string;
};

type AgentToolModelResult = {
  appliedCount?: number;
  cancelled?: boolean;
  error?: string;
  failedCount?: number;
  findingCount?: number;
  message: string;
  partialFailure?: boolean;
  requiresAdminChoice?: boolean;
  selectedChoiceLabel?: string;
  status: "completed" | "failed" | "needs_admin_choice" | "selected";
  taskName?: AdminAgentTaskName;
};

function StartAdminAgentTaskCard({
  args,
  availableTasks,
  onOperationApplied,
  result,
  status,
  respond,
}: StartAdminAgentTaskCardProps) {
  const hasStartedRef = useRef(false);
  const respondRef = useRef<StartAdminAgentTaskCardProps["respond"]>(respond);
  const [localResult, setLocalResult] = useState<StartAdminAgentTaskToolResult | null>(null);
  const [isApplyingApproval, setIsApplyingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const parsedResult = status === "complete" ? parseStartTaskResult(result) : null;
  const visibleResult = localResult ?? parsedResult;
  const canAnswerApproval =
    status === "executing" &&
    Boolean(respondRef.current) &&
    Boolean(visibleResult?.task?.id) &&
    Boolean(visibleResult?.interruption) &&
    !isApplyingApproval;

  useEffect(() => {
    respondRef.current = respond;
  }, [respond]);

  useEffect(() => {
    if (status !== "executing" || !respond || hasStartedRef.current) {
      return;
    }

    const respondToAgent = respond;

    hasStartedRef.current = true;

    async function startTask() {
      const reason = typeof args.reason === "string" ? args.reason : undefined;
      const taskName = toStartableTaskName(args.taskName, availableTasks);

      try {
        if (!taskName) {
          throw new Error("缺少可启动的 Agent 业务处理名称，请从当前业务处理目录中选择。");
        }

        const response = await startAdminAgentTask({
          input: toTaskInput(args.input, reason),
          taskName,
        });
        const toolResult: StartAdminAgentTaskToolResult = {
          events: response.events,
          executed: true,
          findingCount: toOptionalNumber(response.output?.findingCount),
          interruption: response.interruption,
          output: response.output,
          reason,
          task: {
            id: response.task.id,
            status: response.task.status,
          },
          summary: response.summary,
          taskName,
        };

        setLocalResult(toolResult);

        try {
          await onOperationApplied();
        } catch {
          // The backend task was created; a refresh failure should not hide the tool result.
        }

        if (!response.interruption) {
          await respondToAgent(toStartTaskModelResult(toolResult));
        }
      } catch (error) {
        const toolResult: StartAdminAgentTaskToolResult = {
          error: error instanceof Error ? error.message : "Agent 业务处理启动失败。",
          executed: false,
          reason,
          taskName: taskName ?? undefined,
        };

        setLocalResult(toolResult);

        try {
          await respondToAgent(toStartTaskModelResult(toolResult));
        } catch {
          // The local card already shows the startup failure.
        }
      }
    }

    void startTask();
  }, [args.input, args.reason, args.taskName, availableTasks, onOperationApplied, respond, status]);

  async function answerApproval(option: AdminAgentTaskApprovalOption) {
    const currentResult = visibleResult;
    const currentRespond = respondRef.current;

    if (!currentRespond || !currentResult?.task?.id || !currentResult.interruption) {
      return;
    }

    setIsApplyingApproval(true);
    setApprovalError(null);

    try {
      const operations = createApprovalResumeOperations(
        currentResult.interruption,
        option,
        currentResult.task.id,
      );
      const results = await executeAgentOperations(operations);
      const executionSummary = summarizeExecutionResults(results);
      const approvalResult: QuestionToolResult = {
        answer: option.label,
        cancelled: false,
        executed: executionSummary.appliedCount > 0,
        operations,
        partialFailure: executionSummary.failedCount > 0 || executionSummary.skippedCount > 0,
        results,
        selectedChoiceId: option.id,
        selectedChoiceLabel: option.label,
      };
      const nextResult: StartAdminAgentTaskToolResult = {
        ...currentResult,
        approval: approvalResult,
      };

      setLocalResult(nextResult);

      try {
        await onOperationApplied();
      } catch {
        // The resume operation finished; a refresh failure should not hide the approval result.
      }

      try {
        await currentRespond(toQuestionModelResult(approvalResult, currentResult.taskName));
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM 续跑失败。";
        setLocalResult({
          ...nextResult,
          approval: {
            ...approvalResult,
            continuationError: message,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批操作执行失败。";
      const approvalResult: QuestionToolResult = {
        answer: option.label,
        cancelled: false,
        error: message,
        executed: false,
        selectedChoiceId: option.id,
        selectedChoiceLabel: option.label,
      };
      const nextResult: StartAdminAgentTaskToolResult = {
        ...currentResult,
        approval: approvalResult,
      };

      setApprovalError(message);
      setLocalResult(nextResult);

      try {
        await currentRespond(toQuestionModelResult(approvalResult, currentResult.taskName));
      } catch {
        // The execution error is already visible in the local card.
      }
    } finally {
      setIsApplyingApproval(false);
    }
  }

  return (
    <div className="max-w-[min(720px,100%)] rounded-xl border border-border/70 bg-background/70 p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {visibleResult ? (
            visibleResult.executed ? (
              <CheckCircle2 aria-hidden="true" className="size-5" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-5 text-destructive" />
            )
          ) : (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {visibleResult?.executed
              ? `${toTaskLabel(visibleResult.taskName)}正在协作`
              : `正在连接${toTaskLabel(args.taskName)}`}
          </p>
          <p className="mt-1 text-muted-foreground">
            {visibleResult?.summary ?? visibleResult?.error ?? "正在读取上下文并等待业务结果。"}
          </p>
        </div>
      </div>

      {visibleResult ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {typeof visibleResult.findingCount === "number" ? (
            <span className="rounded-full bg-muted px-2 py-1">
              {visibleResult.findingCount ?? 0} 条建议
            </span>
          ) : null}
          {visibleResult.interruption ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">需要确认</span>
          ) : null}
        </div>
      ) : null}

      <AgentTaskTimeline events={visibleResult?.events} />

      {visibleResult?.interruption && !visibleResult.approval ? (
        <AgentApprovalCard
          disabled={!canAnswerApproval}
          error={approvalError}
          interruption={visibleResult.interruption}
          isApplying={isApplyingApproval}
          onSelect={(option) => void answerApproval(option)}
        />
      ) : null}

      {visibleResult?.approval ? <ApprovalResultSummary result={visibleResult.approval} /> : null}
    </div>
  );
}

function ControlAdminAgentTaskCard({
  args,
  agentTasks,
  availableTasks,
  onOperationApplied,
  result,
  status,
  respond,
}: ControlAdminAgentTaskCardProps) {
  const hasStartedRef = useRef(false);
  const respondRef = useRef<ControlAdminAgentTaskCardProps["respond"]>(respond);
  const [localResult, setLocalResult] = useState<ControlAdminAgentTaskToolResult | null>(null);
  const [isApplyingApproval, setIsApplyingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const parsedResult = status === "complete" ? parseControlTaskResult(result) : null;
  const visibleResult = localResult ?? parsedResult;
  const canAnswerApproval =
    status === "executing" &&
    Boolean(respondRef.current) &&
    Boolean(visibleResult?.task?.id) &&
    Boolean(visibleResult?.interruption) &&
    !isApplyingApproval;

  useEffect(() => {
    respondRef.current = respond;
  }, [respond]);

  useEffect(() => {
    if (status !== "executing" || !respond || hasStartedRef.current) {
      return;
    }

    const respondToAgent = respond;

    hasStartedRef.current = true;

    async function controlTask() {
      const sourceTaskId = typeof args.taskId === "string" ? args.taskId.trim() : "";
      const controlTarget = resolveAgentTaskControlTarget(sourceTaskId, agentTasks);
      const action = toTaskControlAction(args.action, controlTarget.effectiveTask, availableTasks);
      const reason = typeof args.reason === "string" ? args.reason : undefined;

      if (!action || !sourceTaskId || !controlTarget.effectiveTask) {
        const toolResult: ControlAdminAgentTaskToolResult = {
          action: action ?? undefined,
          error: "缺少可执行的 Agent 业务处理参数。",
          executed: false,
          reason,
          sourceTaskId: sourceTaskId || undefined,
        };

        setLocalResult(toolResult);
        await respondToAgent(toControlTaskModelResult(toolResult));
        return;
      }

      try {
        const response = await executeTaskControlAction(action, controlTarget.effectiveTask.id);
        const toolResult: ControlAdminAgentTaskToolResult = {
          action,
          effectiveTaskId: controlTarget.effectiveTask.id,
          events: response.events,
          executed: true,
          interruption: response.interruption,
          reason,
          task: {
            id: response.task.id,
            status: response.task.status,
          },
          sourceTaskId,
          summary: response.summary,
        };

        setLocalResult(toolResult);

        try {
          await onOperationApplied();
        } catch {
          // The backend task control action succeeded; refresh failures should not hide it.
        }

        if (!response.interruption) {
          await respondToAgent(toControlTaskModelResult(toolResult));
        }
      } catch (error) {
        const toolResult: ControlAdminAgentTaskToolResult = {
          action,
          effectiveTaskId: controlTarget.effectiveTask.id,
          error: error instanceof Error ? error.message : "Agent 业务处理控制操作失败。",
          executed: false,
          reason,
          sourceTaskId,
        };

        setLocalResult(toolResult);

        try {
          await respondToAgent(toControlTaskModelResult(toolResult));
        } catch {
          // The local card already shows the failure.
        }
      }
    }

    void controlTask();
  }, [
    args.action,
    args.reason,
    args.taskId,
    agentTasks,
    availableTasks,
    onOperationApplied,
    respond,
    status,
  ]);

  const actionLabel = toControlActionLabel(visibleResult?.action ?? args.action);

  async function answerApproval(option: AdminAgentTaskApprovalOption) {
    const currentResult = visibleResult;
    const currentRespond = respondRef.current;

    if (!currentRespond || !currentResult?.task?.id || !currentResult.interruption) {
      return;
    }

    setIsApplyingApproval(true);
    setApprovalError(null);

    try {
      const operations = createApprovalResumeOperations(
        currentResult.interruption,
        option,
        currentResult.task.id,
      );
      const results = await executeAgentOperations(operations);
      const executionSummary = summarizeExecutionResults(results);
      const approvalResult: QuestionToolResult = {
        answer: option.label,
        cancelled: false,
        executed: executionSummary.appliedCount > 0,
        operations,
        partialFailure: executionSummary.failedCount > 0 || executionSummary.skippedCount > 0,
        results,
        selectedChoiceId: option.id,
        selectedChoiceLabel: option.label,
      };
      const nextResult: ControlAdminAgentTaskToolResult = {
        ...currentResult,
        approval: approvalResult,
      };

      setLocalResult(nextResult);

      try {
        await onOperationApplied();
      } catch {
        // The resume operation finished; a refresh failure should not hide the approval result.
      }

      try {
        await currentRespond(toQuestionModelResult(approvalResult));
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM 续跑失败。";
        setLocalResult({
          ...nextResult,
          approval: {
            ...approvalResult,
            continuationError: message,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批操作执行失败。";
      const approvalResult: QuestionToolResult = {
        answer: option.label,
        cancelled: false,
        error: message,
        executed: false,
        selectedChoiceId: option.id,
        selectedChoiceLabel: option.label,
      };
      const nextResult: ControlAdminAgentTaskToolResult = {
        ...currentResult,
        approval: approvalResult,
      };

      setApprovalError(message);
      setLocalResult(nextResult);

      try {
        await currentRespond(toQuestionModelResult(approvalResult));
      } catch {
        // The execution error is already visible in the local tool card.
      }
    } finally {
      setIsApplyingApproval(false);
    }
  }

  return (
    <div className="max-w-[min(720px,100%)] rounded-xl border border-border/70 bg-background/70 p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {visibleResult ? (
            visibleResult.executed ? (
              <CheckCircle2 aria-hidden="true" className="size-5" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-5 text-destructive" />
            )
          ) : (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {visibleResult?.executed ? `${actionLabel}已提交` : `正在准备${actionLabel}`}
          </p>
          <p className="mt-1 text-muted-foreground">
            {toVisibleControlSummary(visibleResult?.summary) ??
              visibleResult?.error ??
              "正在等待业务结果。"}
          </p>
        </div>
      </div>

      {visibleResult?.interruption ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">需要确认</span>
        </div>
      ) : null}

      <AgentTaskTimeline events={visibleResult?.events} />

      {visibleResult?.interruption && !visibleResult.approval ? (
        <AgentApprovalCard
          disabled={!canAnswerApproval}
          error={approvalError}
          interruption={visibleResult.interruption}
          isApplying={isApplyingApproval}
          onSelect={(option) => void answerApproval(option)}
        />
      ) : null}

      {visibleResult?.approval ? <ApprovalResultSummary result={visibleResult.approval} /> : null}
    </div>
  );
}

function AgentTaskTimeline({ events }: { events?: StartAdminAgentTaskResponse["events"] }) {
  const visibleEvents = (events ?? [])
    .map((event) => ({
      ...event,
      description: toVisibleAgentCopy(event.description ?? undefined) ?? null,
      title: toVisibleAgentCopy(event.title) ?? event.title,
    }))
    .filter((event) => event.title);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <ol aria-label="Agent 业务进度" className="mt-3 space-y-2 border-l border-border/70 pl-3">
      {visibleEvents.map((event) => (
        <li className="relative pl-4" key={event.id}>
          <span
            className={cn(
              "left-[-1.4rem] absolute top-0.5 flex size-5 items-center justify-center rounded-full border bg-background",
              event.status === "FAILED" || event.status === "CANCELLED"
                ? "border-destructive/60 text-destructive"
                : event.status === "WAITING_FOR_APPROVAL"
                  ? "border-primary/60 text-primary"
                  : event.status === "IN_PROGRESS"
                    ? "border-primary/50 text-primary"
                    : "border-emerald-500/60 text-emerald-500",
            )}
          >
            {toTaskTimelineIcon(event.status)}
          </span>
          <p className="font-medium text-foreground">{event.title}</p>
          {event.description ? (
            <p className="mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function toTaskTimelineIcon(status: StartAdminAgentTaskResponse["events"][number]["status"]) {
  if (status === "FAILED" || status === "CANCELLED") {
    return <XCircle aria-hidden="true" className="size-3.5" />;
  }

  if (status === "WAITING_FOR_APPROVAL") {
    return <ShieldCheck aria-hidden="true" className="size-3.5" />;
  }

  if (status === "IN_PROGRESS") {
    return <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />;
  }

  return <CheckCircle2 aria-hidden="true" className="size-3.5" />;
}

function AskUserQuestionCard({
  args,
  onOperationApplied,
  result,
  status,
  respond,
}: AskUserQuestionCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localCompletedResult, setLocalCompletedResult] = useState<QuestionToolResult | null>(null);
  const parsedResult = status === "complete" ? parseQuestionResult(result) : null;
  const choices = Array.isArray(args.choices) ? args.choices : [];
  const canAnswer = status === "executing" && Boolean(respond) && choices.length > 0 && !isApplying;

  async function answerQuestion(choice: AskUserQuestionArgs["choices"][number]) {
    if (!respond) {
      return;
    }

    const operations = resolveChoiceOperations(choice);

    if (operations.length === 0) {
      await respond(
        toQuestionModelResult({
          answer: choice.label,
          cancelled: false,
          selectedChoiceLabel: choice.label,
        }),
      );
      return;
    }

    setIsApplying(true);
    setLocalError(null);

    try {
      const results = await executeAgentOperations(operations);
      const executionSummary = summarizeExecutionResults(results);
      const toolResult: QuestionToolResult = {
        answer: choice.label,
        cancelled: false,
        executed: executionSummary.appliedCount > 0,
        operations,
        partialFailure: executionSummary.failedCount > 0 || executionSummary.skippedCount > 0,
        results,
        selectedChoiceId: choice.id,
        selectedChoiceLabel: choice.label,
      };

      setLocalCompletedResult(toolResult);
      try {
        await onOperationApplied();
      } catch {
        // The moderation write already finished; a refresh failure must not overwrite the result.
      }

      try {
        await respond(toQuestionModelResult(toolResult));
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM 续跑失败。";
        setLocalCompletedResult({
          ...toolResult,
          continuationError: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作执行失败。";
      const toolResult: QuestionToolResult = {
        answer: choice.label,
        cancelled: false,
        error: message,
        executed: false,
        operations,
        selectedChoiceId: choice.id,
        selectedChoiceLabel: choice.label,
      };

      setLocalError(message);
      setLocalCompletedResult(toolResult);

      try {
        await respond(toQuestionModelResult(toolResult));
      } catch {
        // The execution error is already visible in the local tool card.
      }
    } finally {
      setIsApplying(false);
    }
  }

  async function skipQuestion() {
    await respond?.(
      toQuestionModelResult({
        cancelled: true,
        reason: "管理员暂不选择。",
      }),
    );
  }

  if (status === "complete" || localCompletedResult) {
    return <CompletedQuestionCard result={localCompletedResult ?? parsedResult} />;
  }

  return (
    <div className="max-w-[min(720px,100%)] rounded-xl border border-border/70 bg-background/70 p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {status === "inProgress" ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <HelpCircle aria-hidden="true" className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{args.question || "Agent 正在准备问题。"}</p>
          {args.context ? <p className="mt-1 text-muted-foreground">{args.context}</p> : null}
        </div>
      </div>

      {choices.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              className="h-auto justify-start px-3 py-2 text-left whitespace-normal"
              disabled={!canAnswer}
              type="button"
              variant="outline"
              onClick={() => void answerQuestion(choice)}
            >
              {isApplying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              <span className="grid gap-1">
                <span className="font-medium">{choice.label}</span>
                {choice.description ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {choice.description}
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/45 px-3 py-2 text-muted-foreground">
          正在准备可选方案。
        </p>
      )}

      {localError ? (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          {localError}
        </p>
      ) : null}

      {status === "executing" ? (
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!respond || isApplying}
            size="sm"
            type="button"
            variant="ghost"
            onClick={skipQuestion}
          >
            暂不选择
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CompletedQuestionCard({ result }: { result: QuestionToolResult | null }) {
  const isCancelled = Boolean(result?.cancelled);
  const isExecuted = Boolean(result?.executed);
  const summary = summarizeExecutionResults(result?.results ?? []);
  const continuationError = result?.continuationError;
  const hasResultRows = Boolean(result?.results?.length);

  return (
    <div className="max-w-[min(720px,100%)] rounded-xl border border-border/70 bg-background/70 p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isCancelled && "bg-muted text-muted-foreground",
            !isCancelled && isExecuted && "bg-primary/10 text-primary",
            !isCancelled && !isExecuted && "bg-primary/10 text-primary",
          )}
        >
          {isCancelled ? (
            <XCircle aria-hidden="true" className="size-5" />
          ) : isExecuted ? (
            <CheckCircle2 aria-hidden="true" className="size-5" />
          ) : (
            <MessageSquareText aria-hidden="true" className="size-5" />
          )}
        </span>
        <div>
          <p className="font-semibold text-foreground">
            {isCancelled ? "已跳过选择" : isExecuted ? "操作已执行" : "已提交选择"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {isCancelled
              ? result?.reason || "管理员暂不选择。"
              : isExecuted
                ? toExecutionSummaryText(summary)
                : hasResultRows
                  ? toExecutionSummaryText(summary)
                  : result?.error ||
                    result?.selectedChoiceLabel ||
                    result?.answer ||
                    "选择已提交。"}
          </p>
          {isExecuted && continuationError ? (
            <p className="mt-2 text-xs text-muted-foreground">
              后台操作已完成，但 Agent 续跑失败：{continuationError}
            </p>
          ) : null}
          {hasResultRows ? <AgentExecutionReceipt results={result?.results ?? []} /> : null}
        </div>
      </div>
    </div>
  );
}

function ApprovalResultSummary({ result }: { result: QuestionToolResult }) {
  const summary = summarizeExecutionResults(result.results ?? []);
  const continuationError = result.continuationError;
  const hasResultRows = Boolean(result.results?.length);
  const isFailed =
    Boolean(result.error) ||
    (summary.failedCount > 0 && summary.appliedCount === 0 && summary.skippedCount === 0);
  const isExecuted = Boolean(result.executed) && summary.appliedCount > 0;

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
            isFailed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          {isFailed ? (
            <RotateCcw aria-hidden="true" className="size-4" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {isFailed ? "操作未完成" : isExecuted ? "操作已执行" : "已提交选择"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {isFailed
              ? result.error || result.selectedChoiceLabel || "操作执行失败。"
              : hasResultRows
                ? toExecutionSummaryText(summary)
                : result.selectedChoiceLabel || result.answer || "选择已提交。"}
          </p>
          {!isFailed && continuationError ? (
            <p className="mt-2 text-xs text-muted-foreground">
              后台操作已完成，但 Agent 续跑失败：{continuationError}
            </p>
          ) : null}
          {result.results?.length ? <AgentExecutionReceipt results={result.results} /> : null}
        </div>
      </div>
    </div>
  );
}

function AgentApprovalCard({
  disabled,
  error,
  interruption,
  isApplying,
  onSelect,
}: {
  disabled: boolean;
  error: string | null;
  interruption: AdminAgentTaskApprovalInterruption;
  isApplying: boolean;
  onSelect: (option: AdminAgentTaskApprovalOption) => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{toVisibleAgentCopy(interruption.question)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {toVisibleAgentCopy(interruption.summary)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {interruption.options.map((option) => (
          <Button
            key={option.id}
            className="h-auto justify-start px-3 py-2 text-left whitespace-normal"
            disabled={disabled}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onSelect(option)}
          >
            {isApplying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            <span className="grid gap-1">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {toVisibleAgentCopy(option.description)}
              </span>
            </span>
          </Button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function createApprovalResumeOperations(
  interruption: AdminAgentTaskApprovalInterruption,
  option: AdminAgentTaskApprovalOption,
  taskId: string,
): AskUserChoiceOperation[] {
  return [
    {
      resume: createApprovalResumePayload(option),
      taskId,
      summary: `${interruption.summary} ${option.label}`,
      type: "agent_task_resume",
    },
  ];
}

function createApprovalResumePayload(option: AdminAgentTaskApprovalOption) {
  return option.resume;
}

type QuestionToolResult = {
  answer?: string;
  cancelled?: boolean;
  continuationError?: string;
  error?: string;
  executed?: boolean;
  operations?: AskUserChoiceOperation[];
  partialFailure?: boolean;
  reason?: string;
  results?: ConfirmedOperationResult[];
  selectedChoiceId?: string;
  selectedChoiceLabel?: string;
};

function toStartTaskModelResult(result: StartAdminAgentTaskToolResult): AgentToolModelResult {
  if (!result.executed) {
    return {
      error: result.error,
      message: result.error ?? "业务处理未能启动。",
      status: "failed",
      taskName: result.taskName,
    };
  }

  if (result.interruption) {
    return {
      findingCount: result.findingCount,
      message: result.summary ?? "业务处理需要管理员选择后继续。",
      requiresAdminChoice: true,
      status: "needs_admin_choice",
      taskName: result.taskName,
    };
  }

  return {
    findingCount: result.findingCount,
    message: result.summary ?? "业务处理已完成。",
    status: "completed",
    taskName: result.taskName,
  };
}

function toControlTaskModelResult(result: ControlAdminAgentTaskToolResult): AgentToolModelResult {
  if (!result.executed) {
    return {
      error: result.error,
      message: result.error ?? "业务处理未完成。",
      status: "failed",
    };
  }

  if (result.interruption) {
    return {
      message: toVisibleControlSummary(result.summary) ?? "业务处理需要管理员选择后继续。",
      requiresAdminChoice: true,
      status: "needs_admin_choice",
    };
  }

  return {
    message: toVisibleControlSummary(result.summary) ?? "业务处理已完成。",
    status: "completed",
  };
}

function toQuestionModelResult(
  result: QuestionToolResult,
  taskName?: AdminAgentTaskName,
): AgentToolModelResult {
  if (result.cancelled) {
    return {
      cancelled: true,
      message: result.reason ?? "管理员暂不选择。",
      status: "selected",
      taskName,
    };
  }

  if (result.error) {
    return {
      error: result.error,
      message: result.error,
      selectedChoiceLabel: result.selectedChoiceLabel ?? result.answer,
      status: "failed",
      taskName,
    };
  }

  const summary = summarizeExecutionResults(result.results ?? []);

  if (result.executed || result.results?.length) {
    return {
      appliedCount: summary.appliedCount,
      failedCount: summary.failedCount,
      message: toExecutionSummaryText(summary),
      partialFailure: Boolean(result.partialFailure),
      selectedChoiceLabel: result.selectedChoiceLabel ?? result.answer,
      status: summary.failedCount > 0 && summary.appliedCount === 0 ? "failed" : "completed",
      taskName,
    };
  }

  return {
    message: result.selectedChoiceLabel ?? result.answer ?? "管理员已提交选择。",
    selectedChoiceLabel: result.selectedChoiceLabel ?? result.answer,
    status: "selected",
    taskName,
  };
}

function parseQuestionResult(result?: string): QuestionToolResult | null {
  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result) as QuestionToolResult;
  } catch {
    return { answer: result };
  }
}

function parseStartTaskResult(result?: string): StartAdminAgentTaskToolResult | null {
  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result) as StartAdminAgentTaskToolResult;
  } catch {
    return {
      error: result,
      executed: false,
    };
  }
}

function toTaskLabel(taskName: unknown) {
  if (taskName === "comment_moderation_analysis") {
    return "评论治理";
  }

  if (taskName === "article_assistance") {
    return "文章协作";
  }

  if (taskName === "audit_review") {
    return "审计分析";
  }

  if (taskName === "site_config_review") {
    return "站点巡检";
  }

  if (taskName === "multi_task_orchestration") {
    return "跨域协作";
  }

  return "Agent";
}

function toControlActionLabel(action: unknown) {
  if (action === "cancel") {
    return "取消";
  }

  if (action === "branch") {
    return "另开处理";
  }

  if (action === "retry") {
    return "重新尝试";
  }

  if (action === "refresh") {
    return "刷新汇总";
  }

  return "继续处理";
}

async function executeTaskControlAction(action: AdminAgentTaskControlAction, taskId: string) {
  return controlAdminAgentTask(taskId, { action });
}

function toTaskControlAction(
  action: unknown,
  task: AdminAgentTaskSummaryResponse | null,
  availableTasks: AdminAgentHomeResponse["tasks"],
): AdminAgentTaskControlAction | null {
  if (typeof action !== "string") {
    return null;
  }

  const normalizedAction = action.trim();

  if (!task) {
    return null;
  }

  const taskCatalogItem = availableTasks.find((item) => item.taskName === task.taskName);
  const availableActions = new Set(
    (taskCatalogItem?.controls ?? [])
      .filter(
        (control) =>
          control.availability === "AVAILABLE" &&
          control.allowedStatuses.includes(task.status) &&
          (!control.requiresPausedTask || task.status === "WAITING_FOR_APPROVAL"),
      )
      .map((control) => control.action),
  );

  if (normalizedAction === "cancel" && availableActions.has("cancel")) {
    return "cancel";
  }

  if (normalizedAction === "branch" && availableActions.has("branch")) {
    return "branch";
  }

  if (normalizedAction === "retry" && availableActions.has("retry")) {
    return "retry";
  }

  if (normalizedAction === "refresh" && availableActions.has("refresh")) {
    return "refresh";
  }

  return null;
}

function resolveAgentTaskControlTarget(
  taskId: string,
  agentTasks: AdminAgentTaskSummaryResponse[],
): { effectiveTask: AdminAgentTaskSummaryResponse | null; sourceTaskId: string } {
  const sourceTask = agentTasks.find((item) => item.id === taskId) ?? null;

  if (!sourceTask) {
    return {
      effectiveTask: null,
      sourceTaskId: taskId,
    };
  }

  if (sourceTask.relation === "retry") {
    return {
      effectiveTask: sourceTask,
      sourceTaskId: taskId,
    };
  }

  const latestRetryAttempt = agentTasks
    .filter((item) => item.relation === "retry" && item.parentTaskId === sourceTask.id)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

  return {
    effectiveTask: latestRetryAttempt ?? sourceTask,
    sourceTaskId: taskId,
  };
}

function toVisibleControlSummary(summary: string | undefined) {
  return toVisibleAgentCopy(summary);
}

function toVisibleAgentCopy(value: string | undefined) {
  if (!value) {
    return value;
  }

  const sanitized = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !internalRuntimeCopyPatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(internalRuntimeInlinePattern, "业务处理")
    .trim();

  return sanitized || "业务处理需要管理员确认。";
}

const internalRuntimeCopyPatterns = [
  /LangGraph/i,
  /checkpoint/i,
  /thread[_\s-]?id/i,
  /workflow(Name)?/i,
  /node/i,
  /agent\/runs/i,
  /运行面板/,
  /运行时/,
  /运行态/,
] as const;

const internalRuntimeInlinePattern =
  /\b(?:LangGraph|checkpoint|thread[_\s-]?id|workflowName|workflow|node|agent\/runs)\b/gi;

function toStartableTaskName(
  taskName: unknown,
  availableTasks: AdminAgentHomeResponse["tasks"],
): AdminAgentTaskName | null {
  if (typeof taskName !== "string") {
    return null;
  }

  const task = availableTasks.find((item) => item.taskName === taskName);

  return task?.availability === "AVAILABLE" && task.supportsStart ? task.taskName : null;
}

function toTaskInput(input: unknown, reason?: string) {
  const base = isPlainRecord(input) ? input : {};

  if (reason) {
    return {
      ...base,
      requestedReason: reason,
    };
  }

  return Object.keys(base).length > 0 ? base : undefined;
}

function isPlainRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function toOptionalNumber(input: unknown) {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function parseControlTaskResult(result?: string): ControlAdminAgentTaskToolResult | null {
  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result) as ControlAdminAgentTaskToolResult;
  } catch {
    return {
      error: result,
      executed: false,
    };
  }
}

export {
  AgentHumanInLoopTools,
  askUserQuestionToolName,
  controlAdminAgentTaskToolName,
  startAdminAgentTaskToolName,
};
