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
    summary: log.summary,
    metadata: sanitizeAdminOperationLogMetadata(log.metadata),
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  };
}

const publicMetadataFields = new Set([
  "action",
  "articleSlug",
  "articleTitle",
  "source",
  "status",
  "targetId",
  "targetIds",
]);

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

  if (!isPlainMetadataObject(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([key]) => publicMetadataFields.has(key))
    .map(([key, item]) => [key, sanitizeMetadataValue(item)] as const)
    .filter(([, item]) => !isEmptyMetadataValue(item));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
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
