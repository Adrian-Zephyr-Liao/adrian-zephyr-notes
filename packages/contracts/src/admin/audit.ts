import type { PaginatedResponse } from "../public/pagination.js";

type AdminOperationLogAction =
  | "ADMIN_AGENT_FINDING_CREATED"
  | "ADMIN_AGENT_FINDING_DECIDED"
  | "ADMIN_AGENT_TASK_CONTROLLED"
  | "ADMIN_AGENT_TASK_RESUMED"
  | "ADMIN_AGENT_TASK_STARTED"
  | "ARTICLE_CREATED"
  | "ARTICLE_DELETED"
  | "ARTICLE_UPDATED"
  | "COMMENT_STATUS_UPDATED"
  | "GUESTBOOK_MESSAGE_UPDATED"
  | "SITE_ANNOUNCEMENT_UPDATED"
  | "SITE_SETTINGS_UPDATED";

type AdminOperationLogListQuery = {
  page?: number;
  pageSize?: number;
  action?: AdminOperationLogAction | "ALL";
  actorLogin?: string;
  q?: string;
};

type AdminOperationLogResponse = {
  id: string;
  actorLogin: string;
  action: AdminOperationLogAction;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AdminOperationLogListResponse = PaginatedResponse<AdminOperationLogResponse>;

export type {
  AdminOperationLogAction,
  AdminOperationLogListQuery,
  AdminOperationLogListResponse,
  AdminOperationLogResponse,
};
