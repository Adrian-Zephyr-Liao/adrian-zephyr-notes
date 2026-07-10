import { createHash } from "node:crypto";
import type { AdminAgentRun, AdminAgentWorkflowName } from "./admin-agent-run.entity";
import { extractLlmJsonObject, normalizeLlmText } from "./admin-agent-llm-response";
import type { AdminAgentGenericApprovalRequest } from "./admin-agent-workflow-approval";
import {
  findAdminAgentWorkflowMetadataByTaskName,
  listAdminAgentWorkflowMetadata,
} from "./admin-agent-workflow-metadata";
import type { AdminAgentWorkflowResult } from "./admin-agent-workflow-runner";

type MultiTaskChildWorkflowName = Extract<
  AdminAgentWorkflowName,
  "ARTICLE_ASSISTANCE" | "AUDIT_REVIEW" | "COMMENT_MODERATION_ANALYSIS" | "SITE_CONFIG_REVIEW"
>;

type MultiTaskPlanItem = {
  input: Record<string, unknown>;
  reason: string;
  workflowName: MultiTaskChildWorkflowName;
};

type MultiTaskChildResult = {
  childTaskKey: string | null;
  errorMessage: string | null;
  interruptionKind: string | null;
  output: Record<string, unknown> | null;
  runId: string | null;
  status: string;
  summary: string;
  workflowName: MultiTaskChildWorkflowName;
};

type MultiTaskOrchestrationOutput = {
  childResults: MultiTaskChildResult[];
  plan: MultiTaskPlanItem[];
  planSummary: string;
  plannedTaskCount: number;
};
type MultiTaskOrchestrationCompletionResult = {
  output: MultiTaskOrchestrationOutput;
  summary: string;
};

type MultiTaskPlanParseResult = {
  plan: MultiTaskPlanItem[];
  summary: string;
};

type MultiTaskPlanPromptMessage = {
  content: string;
  role: "system" | "user";
};

type CreateMultiTaskApprovalRequestInput = {
  plan: MultiTaskPlanItem[];
  summary?: string | null;
};

const multiTaskOrchestrationWorkflowName =
  "MULTI_TASK_ORCHESTRATION" satisfies AdminAgentWorkflowName;

function buildMultiTaskPlanMessages(input: Record<string, unknown>): MultiTaskPlanPromptMessage[] {
  const childTaskOptions = listMultiTaskChildTaskOptions();
  const taskNames = childTaskOptions.map((task) => task.taskName);

  return [
    {
      content: [
        "你是 AZ Notes 后台 Agent 的多任务规划节点。",
        "你只负责选择需要启动的 Agent 业务处理，不直接执行写操作，不输出面向用户的 Markdown。",
        `只能选择这些 taskName：${taskNames.join("、")}。`,
        "禁止选择 multi_task_orchestration，禁止编造其他 taskName。",
        "输出必须是严格 JSON，不要 Markdown，不要代码块，不要解释。",
        `JSON 结构：{"summary":"中文规划总结","tasks":[{"taskName":"${taskNames.join("|")}","reason":"为什么启动","input":{}}]}`,
      ].join("\n"),
      role: "system",
    },
    {
      content: JSON.stringify({
        availableTasks: childTaskOptions,
        requestedInput: input,
      }),
      role: "user",
    },
  ];
}

function parseMultiTaskPlanResponse(response: string): MultiTaskPlanParseResult {
  const parsed = JSON.parse(extractLlmJsonObject(response, "Multi-task orchestration")) as unknown;

  if (!isPlainMultiTaskRecord(parsed)) {
    throw new Error("Multi-task orchestration response must be a JSON object.");
  }

  const plan = normalizeMultiTaskPlan(parsed);

  return {
    plan,
    summary: normalizeLlmText(
      parsed.summary,
      plan.length > 0
        ? `已规划 ${plan.length} 个 Agent 业务处理。`
        : "未找到需要启动的 Agent 业务处理。",
      1000,
    ),
  };
}

function normalizeMultiTaskPlan(input: Record<string, unknown>): MultiTaskPlanItem[] {
  const rawTasks = Array.isArray(input.tasks)
    ? input.tasks
    : Array.isArray(input.taskNames)
      ? input.taskNames
      : [];

  return rawTasks
    .flatMap((item): MultiTaskPlanItem[] => {
      const normalized =
        typeof item === "string"
          ? {
              input: {},
              reason: "用户明确指定的 Agent 业务处理。",
              taskName: item,
            }
          : normalizeMultiTaskPlanRecord(item);
      const workflowName = normalizeMultiTaskTaskName(
        normalized?.taskName ?? normalized?.workflowName,
      );

      if (!workflowName) {
        return [];
      }

      return [
        {
          input: isPlainMultiTaskRecord(normalized?.input) ? normalized.input : {},
          reason: normalizeLlmText(normalized?.reason, "需要执行该 Agent 业务处理。", 240),
          workflowName,
        },
      ];
    })
    .slice(0, 6);
}

function toMultiTaskChildResult(run: AdminAgentRun): MultiTaskChildResult {
  return {
    childTaskKey: toWorkflowRunDedupeKey(run),
    errorMessage: run.errorMessage,
    interruptionKind: toInterruptionKind(run.interruption),
    output: run.output,
    runId: run.id,
    status: run.status,
    summary: run.summary || "",
    workflowName: run.workflowName as MultiTaskChildWorkflowName,
  };
}

function createMultiTaskChildResultFromWorkflowResult(input: {
  result: AdminAgentWorkflowResult;
  workflowName: MultiTaskChildWorkflowName;
}): MultiTaskChildResult {
  return {
    childTaskKey: toWorkflowRunDedupeKey(input.result.run),
    errorMessage: input.result.run.errorMessage,
    interruptionKind: input.result.interruption?.kind ?? null,
    output: input.result.output ?? null,
    runId: input.result.run.id,
    status: input.result.run.status,
    summary: input.result.summary,
    workflowName: input.workflowName,
  };
}

function createMultiTaskChildFailureResult(input: {
  childTaskKey: string;
  errorMessage: string;
  runId: string | null;
  workflowName: MultiTaskChildWorkflowName;
}): MultiTaskChildResult {
  return {
    childTaskKey: input.childTaskKey,
    errorMessage: input.errorMessage,
    interruptionKind: null,
    output: null,
    runId: input.runId,
    status: "FAILED",
    summary: input.errorMessage,
    workflowName: input.workflowName,
  };
}

function toWorkflowRunDedupeKey(run: AdminAgentRun) {
  const dedupeKey = run.dedupeKey ?? run.metadata?.dedupeKey;

  return typeof dedupeKey === "string" && dedupeKey.trim() ? dedupeKey.trim() : null;
}

function toMultiTaskChildDedupeKey(parentRunId: string, _index: number, item: MultiTaskPlanItem) {
  const payloadHash = createHash("sha256")
    .update(`${item.workflowName}\n${stableJsonStringify(item.input)}`)
    .digest("hex")
    .slice(0, 16);

  return `multi-task-child:${parentRunId}:${item.workflowName}:${payloadHash}`;
}

function createMultiTaskOrchestrationOutput(input: {
  childResults: MultiTaskChildResult[];
  plan: MultiTaskPlanItem[];
  summary: string;
}): MultiTaskOrchestrationOutput {
  return {
    childResults: input.childResults,
    plan: input.plan,
    planSummary: input.summary,
    plannedTaskCount: input.plan.length,
  };
}

function buildMultiTaskSummary(input: {
  childResults: MultiTaskChildResult[];
  plan: MultiTaskPlanItem[];
  summary: string;
}) {
  if (input.plan.length === 0) {
    return input.summary || "多任务编排已完成，未启动 Agent 业务处理。";
  }

  const waitingCount = input.childResults.filter(
    (result) => result.status === "WAITING_FOR_APPROVAL",
  ).length;
  const completedCount = input.childResults.filter(
    (result) => result.status === "COMPLETED",
  ).length;
  const failedCount = input.childResults.filter((result) => result.status === "FAILED").length;

  return [
    input.summary || `多任务编排已启动 ${input.childResults.length} 个 Agent 业务处理。`,
    `结果：完成 ${completedCount} 个，等待确认 ${waitingCount} 个，失败 ${failedCount} 个。`,
  ].join("\n");
}

function createMultiTaskCompletionResult(input: {
  childResults: MultiTaskChildResult[];
  plan: MultiTaskPlanItem[];
  summary: string;
}): MultiTaskOrchestrationCompletionResult {
  return {
    output: createMultiTaskOrchestrationOutput({
      childResults: input.childResults,
      plan: input.plan,
      summary: input.summary,
    }),
    summary: buildMultiTaskSummary(input),
  };
}

function toMultiTaskPlanFromOutput(output: Record<string, unknown> | null): MultiTaskPlanItem[] {
  if (!isPlainMultiTaskRecord(output)) {
    return [];
  }

  return normalizeMultiTaskPlan({
    tasks: output.plan,
  });
}

function toMultiTaskPlanSummaryFromOutput(output: Record<string, unknown> | null) {
  if (!isPlainMultiTaskRecord(output) || typeof output.planSummary !== "string") {
    return "";
  }

  return normalizeLlmText(output.planSummary, "", 1000);
}

function createMultiTaskApprovalRequest(
  input: CreateMultiTaskApprovalRequestInput,
): AdminAgentGenericApprovalRequest {
  return {
    action: "APPROVE_MULTI_TASK_PLAN",
    payload: {
      plan: input.plan,
    },
    question: `是否确认启动 ${input.plan.length} 个 Agent 业务处理？`,
    subject: "MULTI_TASK",
    summary: input.summary || `多任务编排已规划 ${input.plan.length} 个业务处理。`,
  };
}

function toInterruptionKind(interruption: Record<string, unknown> | null) {
  const kind = interruption?.kind;

  return typeof kind === "string" ? kind : null;
}

function normalizeMultiTaskPlanRecord(value: unknown) {
  return isPlainMultiTaskRecord(value) ? value : null;
}

function normalizeMultiTaskTaskName(value: unknown): MultiTaskChildWorkflowName | null {
  if (typeof value !== "string") {
    return null;
  }

  const metadata = findAdminAgentWorkflowMetadataByTaskName(value);

  if (metadata && isMultiTaskChildWorkflowName(metadata.workflowName)) {
    return metadata.workflowName as MultiTaskChildWorkflowName;
  }

  return isMultiTaskChildWorkflowName(value) ? value : null;
}

function listMultiTaskChildTaskOptions() {
  return listAdminAgentWorkflowMetadata()
    .filter(
      (metadata) =>
        metadata.supportsStart && metadata.workflowName !== multiTaskOrchestrationWorkflowName,
    )
    .map((metadata) => ({
      description: metadata.description,
      taskName: metadata.taskName,
    }));
}

function listMultiTaskChildWorkflowNames() {
  return listAdminAgentWorkflowMetadata()
    .filter(
      (metadata) =>
        metadata.supportsStart && metadata.workflowName !== multiTaskOrchestrationWorkflowName,
    )
    .map((metadata) => metadata.workflowName as MultiTaskChildWorkflowName);
}

function isMultiTaskChildWorkflowName(value: string): value is MultiTaskChildWorkflowName {
  return listMultiTaskChildWorkflowNames().some((workflowName) => workflowName === value);
}

function isPlainMultiTaskRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableJsonStringify(value: unknown) {
  return JSON.stringify(toStableJsonValue(value));
}

function toStableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStableJsonValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPlainMultiTaskRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, toStableJsonValue(value[key])]),
    );
  }

  return value;
}

export {
  buildMultiTaskPlanMessages,
  buildMultiTaskSummary,
  createMultiTaskChildFailureResult,
  createMultiTaskChildResultFromWorkflowResult,
  createMultiTaskApprovalRequest,
  createMultiTaskCompletionResult,
  createMultiTaskOrchestrationOutput,
  normalizeMultiTaskPlan,
  parseMultiTaskPlanResponse,
  toMultiTaskChildDedupeKey,
  toMultiTaskChildResult,
  toMultiTaskPlanFromOutput,
  toMultiTaskPlanSummaryFromOutput,
  toWorkflowRunDedupeKey,
};
export type {
  MultiTaskChildResult,
  MultiTaskChildWorkflowName,
  CreateMultiTaskApprovalRequestInput,
  MultiTaskOrchestrationCompletionResult,
  MultiTaskOrchestrationOutput,
  MultiTaskPlanPromptMessage,
  MultiTaskPlanItem,
  MultiTaskPlanParseResult,
};
