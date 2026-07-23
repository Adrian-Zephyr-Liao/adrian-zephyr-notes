import type {
  AdminAgentFindingResponse,
  AdminAgentConversationMessagesResponse,
  AdminAgentHomeResponse,
  AdminAgentTaskListResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskTimelineEventResponse,
  AdminAgentTaskOutputResponse,
  ResumeAdminAgentTaskResponse,
} from "@adrian-zephyr-notes/contracts";
import type { AdminAgentHome } from "../application/get-admin-agent-home.use-case";
import type {
  AdminAgentFinding,
  AdminAgentFindingTarget,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentMessage } from "../domain/admin-agent-chat-message.repository";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import type { AdminAgentWorkflowEvent } from "../domain/admin-agent-workflow-event.entity";
import type { AdminAgentWorkflowResult } from "../domain/admin-agent-workflow-runner";
import { toAdminAgentTaskName } from "../domain/admin-agent-workflow-metadata";
import {
  evaluateAdminAgentAutomationEligibility,
  type AdminAgentAutomationEligibilityResult,
  type AdminAgentAutomationPolicy,
} from "../domain/admin-agent-automation-policy";

function toAdminAgentHomeResponse(home: AdminAgentHome): AdminAgentHomeResponse {
  return {
    assistantBrief: home.assistantBrief,
    automationCandidateCount: home.automationCandidateCount,
    automationPolicy: home.automationPolicy,
    capabilities: home.capabilities,
    executedActionCount: home.executedActionCount,
    findings: home.findings.map((finding) =>
      toAdminAgentFindingResponse(finding, home.automationPolicy),
    ),
    lastUpdatedAt: home.lastUpdatedAt.toISOString(),
    pendingFindingCount: home.pendingFindingCount,
    recentActions: home.recentActions.map((action) => ({
      ...action,
      createdAt: action.createdAt.toISOString(),
    })),
    tasks: home.tasks,
    todayCommentCount: home.todayCommentCount,
    todayHiddenCommentCount: home.todayHiddenCommentCount,
    todayVisibleCommentCount: home.todayVisibleCommentCount,
  };
}

function toAdminAgentFindingResponse(
  finding: AdminAgentFinding,
  automationPolicy: AdminAgentAutomationPolicy | null = null,
): AdminAgentFindingResponse {
  return {
    automationEligibility: automationPolicy
      ? toAdminAgentAutomationEligibilityResponse(
          evaluateAdminAgentAutomationEligibility(finding, automationPolicy),
        )
      : null,
    category: finding.category,
    confidence: finding.confidence,
    createdAt: finding.createdAt.toISOString(),
    evidence: finding.evidence,
    id: finding.id,
    proposedAction: finding.proposedAction,
    reason: finding.reason,
    severity: finding.severity,
    status: finding.status,
    taskId: finding.runId,
    target: finding.target ? toAdminAgentFindingTargetResponse(finding.target) : null,
    targetId: finding.targetId,
    targetType: finding.targetType,
  };
}

type AdminAgentWorkflowResultWithEvents = AdminAgentWorkflowResult & {
  events?: AdminAgentWorkflowEvent[];
};

function toAdminAgentTaskResponse(
  result: AdminAgentWorkflowResultWithEvents,
): ResumeAdminAgentTaskResponse {
  return {
    events: toAdminAgentTaskTimelineEventResponses(result.events ?? []),
    interruption: result.interruption,
    output: toPublicAdminAgentTaskOutput(result.output),
    task: toAdminAgentTaskSummaryResponse(result.run),
    summary: result.summary,
  };
}

function toAdminAgentTaskListResponse(result: {
  data: AdminAgentRun[];
  latestEventsByRunId?: ReadonlyMap<string, AdminAgentWorkflowEvent>;
  pagination: AdminAgentTaskListResponse["pagination"];
}): AdminAgentTaskListResponse {
  return {
    data: result.data.map((run) =>
      toAdminAgentTaskSummaryResponse(run, result.latestEventsByRunId?.get(run.id) ?? null),
    ),
    pagination: result.pagination,
  };
}

function toAdminAgentTaskSummaryResponse(
  run: AdminAgentRun,
  latestEvent: AdminAgentWorkflowEvent | null = null,
): AdminAgentTaskSummaryResponse {
  return {
    createdAt: run.createdAt.toISOString(),
    errorMessage: run.errorMessage,
    id: run.id,
    latestEvent: latestEvent ? toAdminAgentTaskTimelineEventResponse(latestEvent) : null,
    parentTaskId: run.parentRunId,
    relation: toAdminAgentTaskRelation(run.parentRunRelation),
    status: run.status,
    summary: run.summary,
    taskName: toAdminAgentTaskName(run.workflowName),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function toAdminAgentTaskRelation(
  relation: AdminAgentRun["parentRunRelation"],
): AdminAgentTaskSummaryResponse["relation"] {
  if (relation === "BRANCH") {
    return "branch";
  }

  if (relation === "CHILD_TASK") {
    return "child";
  }

  if (relation === "RETRY") {
    return "retry";
  }

  return null;
}

function toAdminAgentTaskTimelineEventResponses(
  events: AdminAgentWorkflowEvent[],
): AdminAgentTaskTimelineEventResponse[] {
  return events
    .map(toAdminAgentTaskTimelineEventResponse)
    .filter((event): event is AdminAgentTaskTimelineEventResponse => Boolean(event));
}

function toAdminAgentTaskTimelineEventResponse(
  event: AdminAgentWorkflowEvent,
): AdminAgentTaskTimelineEventResponse | null {
  const title = toAdminAgentTaskTimelineTitle(event);
  const description = toAdminAgentTaskTimelineDescription(event, title);

  if (!title) {
    return null;
  }

  return {
    createdAt: event.createdAt.toISOString(),
    description,
    id: event.id,
    status: toAdminAgentTaskTimelineStatus(event),
    title,
  };
}

function toAdminAgentTaskTimelineTitle(event: AdminAgentWorkflowEvent) {
  if (event.type === "RUN_CREATED") {
    return "创建任务";
  }

  if (event.type === "RUN_ATTEMPT_STARTED") {
    return "开始处理";
  }

  if (event.type === "RUN_RESUMED") {
    return "继续处理";
  }

  if (event.type === "NODE_STARTED") {
    return "处理进度";
  }

  if (event.type === "INTERRUPTED") {
    return "等待确认";
  }

  if (event.type === "COMPLETED") {
    return "处理完成";
  }

  if (event.type === "FAILED") {
    return "处理失败";
  }

  if (event.type === "CANCELLED") {
    return "已取消";
  }

  if (event.type === "CONTROLLED") {
    return toAdminAgentTaskControlTimelineTitle(event.payload);
  }

  return "状态更新";
}

function toAdminAgentTaskControlTimelineTitle(payload: Record<string, unknown> | null) {
  const action = isPlainTaskOutputRecord(payload) ? payload.action : null;

  if (action === "branch") {
    return "另开处理";
  }

  if (action === "cancel") {
    return "取消处理";
  }

  if (action === "refresh") {
    return "刷新结果";
  }

  if (action === "retry") {
    return "重新尝试";
  }

  if (action === "resume") {
    return "继续执行";
  }

  return "处理操作";
}

function toAdminAgentTaskTimelineDescription(event: AdminAgentWorkflowEvent, title: string) {
  if (!event.summary || isInternalTaskOutputValue(event.summary)) {
    return null;
  }

  const description = event.summary.replace(internalTaskOutputInlinePattern, "业务处理").trim();

  return description && description !== title ? description : null;
}

function toAdminAgentTaskTimelineStatus(
  event: AdminAgentWorkflowEvent,
): AdminAgentTaskTimelineEventResponse["status"] {
  if (event.type === "FAILED") {
    return "FAILED";
  }

  if (event.type === "CANCELLED") {
    return "CANCELLED";
  }

  if (event.type === "INTERRUPTED") {
    return "WAITING_FOR_APPROVAL";
  }

  if (
    event.type === "NODE_STARTED" ||
    event.type === "RUN_ATTEMPT_STARTED" ||
    event.type === "RUN_RESUMED"
  ) {
    return "IN_PROGRESS";
  }

  if (event.type === "CONTROLLED") {
    return toAdminAgentTaskTimelineStatusFromPayload(event.payload);
  }

  return "COMPLETED";
}

function toAdminAgentTaskTimelineStatusFromPayload(
  payload: Record<string, unknown> | null,
): AdminAgentTaskTimelineEventResponse["status"] {
  const resultStatus = isPlainTaskOutputRecord(payload) ? payload.resultStatus : null;

  if (resultStatus === "CANCELLED") {
    return "CANCELLED";
  }

  if (resultStatus === "COMPLETED") {
    return "COMPLETED";
  }

  if (resultStatus === "FAILED") {
    return "FAILED";
  }

  if (resultStatus === "RUNNING") {
    return "IN_PROGRESS";
  }

  if (resultStatus === "WAITING_FOR_APPROVAL") {
    return "WAITING_FOR_APPROVAL";
  }

  return "PENDING";
}

function toAdminAgentConversationMessagesResponse(
  messages: AdminAgentMessage[],
): AdminAgentConversationMessagesResponse {
  return {
    data: messages,
  };
}

function toAdminAgentAutomationEligibilityResponse(
  result: AdminAgentAutomationEligibilityResult,
): AdminAgentFindingResponse["automationEligibility"] {
  return result.eligible
    ? {
        action: result.action,
        eligible: true as const,
      }
    : {
        eligible: false as const,
        reason: result.reason,
      };
}

function toAdminAgentFindingTargetResponse(target: AdminAgentFindingTarget) {
  return {
    ...target,
    createdAt: target.createdAt.toISOString(),
  };
}

const omittedAdminAgentTaskOutputValue = Symbol("omitted-admin-agent-task-output-value");

const internalTaskOutputFields = new Set([
  "checkpointId",
  "checkpointNamespace",
  "currentNode",
  "langGraphRunId",
  "langgraphRunId",
  "node",
  "rawLangGraphState",
  "runId",
  "threadId",
  "workflow",
  "workflowCheckpoint",
  "workflowName",
  "workflowRevision",
  "workflowRunId",
]);

const internalTaskOutputFieldPatterns = [
  /checkpoint/i,
  /lang[_-]?graph/i,
  /^node$/i,
  /runtime/i,
  /^thread[_-]?id$/i,
  /workflow/i,
];

const internalTaskOutputValuePatterns = [
  /agent[./_-]?runs/i,
  /checkpoint/i,
  /lang[_-]?graph/i,
  /runtime\s*panel/i,
  /thread[_-]?id/i,
  /workflow(?:Name|RunId)?/i,
  /运行面板/,
  /运行态/,
  /运行时/,
];

const internalTaskOutputInlinePattern =
  /\b(?:LangGraph|checkpoint|thread[_-]?id|workflowName|workflow|node|agent[./_-]?runs)\b/gi;

function toPublicAdminAgentTaskOutput(
  output: AdminAgentWorkflowResult["output"],
): AdminAgentTaskOutputResponse {
  const sanitized = sanitizeAdminAgentTaskOutputValue(output);

  return isPlainTaskOutputRecord(sanitized) ? sanitized : {};
}

function sanitizeAdminAgentTaskOutputValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAdminAgentTaskOutputValue(item))
      .filter((item) => item !== omittedAdminAgentTaskOutputValue);
  }

  if (typeof value === "string" && isInternalTaskOutputValue(value)) {
    return omittedAdminAgentTaskOutputValue;
  }

  if (!isPlainTaskOutputRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isInternalTaskOutputField(key))
      .map(([key, item]) => [key, sanitizeAdminAgentTaskOutputValue(item)] as const)
      .filter(([, item]) => item !== omittedAdminAgentTaskOutputValue),
  );
}

function isInternalTaskOutputField(key: string) {
  return (
    internalTaskOutputFields.has(key) ||
    internalTaskOutputFieldPatterns.some((pattern) => pattern.test(key))
  );
}

function isInternalTaskOutputValue(value: string) {
  return internalTaskOutputValuePatterns.some((pattern) => pattern.test(value));
}

function isPlainTaskOutputRecord(value: unknown): value is AdminAgentTaskOutputResponse {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  toAdminAgentFindingResponse,
  toAdminAgentConversationMessagesResponse,
  toAdminAgentHomeResponse,
  toAdminAgentTaskSummaryResponse,
  toAdminAgentTaskResponse,
  toAdminAgentTaskListResponse,
};
