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

type AdminOperationLog = {
  id: string;
  actorUserId: string | null;
  actorLogin: string;
  action: AdminOperationLogAction;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

type AdminOperationActor = {
  id: string | null;
  login: string;
};

type AdminOperationRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type {
  AdminOperationActor,
  AdminOperationLog,
  AdminOperationLogAction,
  AdminOperationRequestContext,
};
