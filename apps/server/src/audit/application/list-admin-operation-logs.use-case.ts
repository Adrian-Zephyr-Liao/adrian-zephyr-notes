import { Inject, Injectable } from "@nestjs/common";
import type { AdminOperationLogAction } from "../domain/admin-operation-log";
import {
  ADMIN_OPERATION_LOG_REPOSITORY,
  type AdminOperationLogRepository,
  type ListAdminOperationLogsFilters,
} from "../domain/admin-operation-log.repository";

type ListAdminOperationLogsInput = {
  page?: number;
  pageSize?: number;
  action?: string;
  actorLogin?: string;
  search?: string;
};

@Injectable()
class ListAdminOperationLogsUseCase {
  constructor(
    @Inject(ADMIN_OPERATION_LOG_REPOSITORY)
    private readonly adminOperationLogRepository: AdminOperationLogRepository,
  ) {}

  execute(input: ListAdminOperationLogsInput = {}) {
    return this.adminOperationLogRepository.list(normalizeListAdminOperationLogsInput(input));
  }
}

function normalizeListAdminOperationLogsInput(
  input: ListAdminOperationLogsInput,
): ListAdminOperationLogsFilters {
  return {
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
    action: normalizeAction(input.action),
    actorLogin: normalizeOptionalText(input.actorLogin),
    search: normalizeOptionalText(input.search),
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return fallback;
  }

  return value;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAction(value: string | undefined): AdminOperationLogAction | undefined {
  return value === "ADMIN_AGENT_FINDING_CREATED" ||
    value === "ADMIN_AGENT_FINDING_DECIDED" ||
    value === "ADMIN_AGENT_TASK_CONTROLLED" ||
    value === "ADMIN_AGENT_TASK_RESUMED" ||
    value === "ADMIN_AGENT_TASK_STARTED" ||
    value === "ARTICLE_UPDATED" ||
    value === "ARTICLE_CATEGORY_CREATED" ||
    value === "ARTICLE_CATEGORY_DELETED" ||
    value === "ARTICLE_CATEGORY_UPDATED" ||
    value === "ARTICLE_TAG_CREATED" ||
    value === "ARTICLE_TAG_DELETED" ||
    value === "ARTICLE_TAG_MERGED" ||
    value === "ARTICLE_TAG_UPDATED" ||
    value === "ARTICLE_CREATED" ||
    value === "ARTICLE_DELETED" ||
    value === "COMMENT_STATUS_UPDATED" ||
    value === "GUESTBOOK_MESSAGE_UPDATED" ||
    value === "SITE_ANNOUNCEMENT_UPDATED" ||
    value === "SITE_SETTINGS_UPDATED"
    ? value
    : undefined;
}

export { ListAdminOperationLogsUseCase, normalizeListAdminOperationLogsInput };
export type { ListAdminOperationLogsInput };
