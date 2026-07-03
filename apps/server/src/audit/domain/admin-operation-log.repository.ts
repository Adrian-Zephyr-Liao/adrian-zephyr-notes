import type {
  AdminOperationActor,
  AdminOperationLog,
  AdminOperationLogAction,
  AdminOperationRequestContext,
} from "./admin-operation-log";

type ListAdminOperationLogsFilters = {
  page: number;
  pageSize: number;
  action?: AdminOperationLogAction;
  actorLogin?: string;
  search?: string;
};

type AdminOperationLogsPage = {
  data: AdminOperationLog[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type RecordAdminOperationInput = {
  actor: AdminOperationActor;
  action: AdminOperationLogAction;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  requestContext?: AdminOperationRequestContext;
};

interface AdminOperationLogRepository {
  list(filters: ListAdminOperationLogsFilters): Promise<AdminOperationLogsPage>;
  record(input: RecordAdminOperationInput): Promise<AdminOperationLog>;
}

const ADMIN_OPERATION_LOG_REPOSITORY = Symbol("ADMIN_OPERATION_LOG_REPOSITORY");

export { ADMIN_OPERATION_LOG_REPOSITORY };
export type {
  AdminOperationLogRepository,
  AdminOperationLogsPage,
  ListAdminOperationLogsFilters,
  RecordAdminOperationInput,
};
