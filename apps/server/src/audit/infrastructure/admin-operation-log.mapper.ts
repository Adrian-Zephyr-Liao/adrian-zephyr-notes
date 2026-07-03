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
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  };
}

export { toAdminOperationLogListResponse, toAdminOperationLogResponse };
