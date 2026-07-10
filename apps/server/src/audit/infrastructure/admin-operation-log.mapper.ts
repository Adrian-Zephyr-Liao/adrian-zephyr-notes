import type {
  AdminOperationLogListResponse,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import type { AdminOperationLog } from "../domain/admin-operation-log";
import type { AdminOperationLogsPage } from "../domain/admin-operation-log.repository";

function toAdminOperationLogListResponse(
  page: AdminOperationLogsPage,
): AdminOperationLogListResponse {
  return {
    data: page.data.map(toAdminOperationLogResponse),
    pagination: page.pagination,
  };
}

function toAdminOperationLogResponse(log: AdminOperationLog): AdminOperationLogResponse {
  return {
    id: log.id,
    actorLogin: log.actorLogin,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    summary: sanitizeAdminOperationLogSummary(log.summary),
    metadata: sanitizeAdminOperationLogMetadata(log.metadata),
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  };
}

const internalMetadataFields = new Set([
  "agentRunId",
  "agentTaskId",
  "checkpointId",
  "checkpointNamespace",
  "currentNode",
  "langGraphRunId",
  "langgraphRunId",
  "node",
  "rawLangGraphState",
  "runId",
  "threadId",
  "workflowCheckpoint",
  "workflowName",
  "workflowRevision",
  "workflowRunId",
]);

const internalMetadataFieldPatterns = [
  /checkpoint/i,
  /lang[_-]?graph/i,
  /^node$/i,
  /^run[_-]?id$/i,
  /runtime/i,
  /^thread[_-]?id$/i,
  /workflow/i,
];

const internalSummaryPatterns = [
  /agent[./_-]?runs/i,
  /checkpoint/i,
  /debug/i,
  /lang[_-]?graph/i,
  /runtime/i,
  /runtime\s*panel/i,
  /thread[_-]?id/i,
  /workflow(?:Name|RunId)?/i,
  /运行面板/,
  /运行态/,
  /运行时/,
];

const publicMetadataFields = new Set([
  "action",
  "agentFindingId",
  "articleSlug",
  "decision",
  "findingCount",
  "source",
  "status",
  "targetId",
  "targetIds",
  "taskTitle",
]);

function sanitizeAdminOperationLogSummary(summary: string) {
  return internalSummaryPatterns.some((pattern) => pattern.test(summary))
    ? "Recorded an admin operation."
    : summary;
}

function sanitizeAdminOperationLogMetadata(
  metadata: AdminOperationLog["metadata"],
): AdminOperationLogResponse["metadata"] {
  const sanitized = sanitizeMetadataValue(metadata);

  return isPlainMetadataObject(sanitized) ? sanitized : null;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => sanitizeMetadataValue(item))
      .filter((item) => !isEmptyMetadataValue(item));

    return items.length > 0 ? items : null;
  }

  if (typeof value === "string" && isInternalMetadataValue(value)) {
    return null;
  }

  if (!isPlainMetadataObject(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([key]) => publicMetadataFields.has(key) && !isInternalMetadataField(key))
    .map(([key, item]) => [key, sanitizeMetadataValue(item)] as const)
    .filter(([, item]) => !isEmptyMetadataValue(item));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function isInternalMetadataField(key: string) {
  return (
    internalMetadataFields.has(key) ||
    internalMetadataFieldPatterns.some((pattern) => pattern.test(key))
  );
}

function isInternalMetadataValue(value: string) {
  return internalSummaryPatterns.some((pattern) => pattern.test(value));
}

function isPlainMetadataObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isEmptyMetadataValue(value: unknown) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

export {
  sanitizeAdminOperationLogMetadata,
  toAdminOperationLogListResponse,
  toAdminOperationLogResponse,
};
