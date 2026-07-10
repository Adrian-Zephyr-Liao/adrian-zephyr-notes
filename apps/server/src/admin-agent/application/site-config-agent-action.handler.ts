import { Injectable } from "@nestjs/common";
import {
  AdminAgentWorkflowActionValidationError,
  type AdminAgentWorkflowActionExecutionResult,
  type AdminAgentWorkflowActionHandler,
  type ExecuteAdminAgentWorkflowActionInput,
} from "../domain/admin-agent-workflow-action-executor";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import { UpdateAdminSiteAnnouncementUseCase } from "../../site-config/application/update-admin-site-announcement.use-case";

@Injectable()
class SiteConfigAgentActionHandler implements AdminAgentWorkflowActionHandler {
  readonly actionKey = "SITE_CONFIG.UPDATE_SITE_ANNOUNCEMENT" as const;

  constructor(
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateAdminSiteAnnouncement: UpdateAdminSiteAnnouncementUseCase,
  ) {}

  async execute(
    input: ExecuteAdminAgentWorkflowActionInput,
  ): Promise<AdminAgentWorkflowActionExecutionResult> {
    const updateInput = toUpdateSiteAnnouncementInput(input.payload);
    const announcement = await this.updateAdminSiteAnnouncement.execute(updateInput);

    await this.recordAdminOperation.execute({
      action: "SITE_ANNOUNCEMENT_UPDATED",
      actor: input.actor,
      metadata: {
        agentAction: input.action,
        isEnabled: announcement.isEnabled,
        key: announcement.key,
        source: "admin_agent",
        sortOrder: announcement.sortOrder,
      },
      requestContext: input.requestContext,
      resourceId: announcement.id,
      resourceType: "site_announcement",
    });

    return {
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: announcement.id,
          status: "APPLIED",
          summary: `站点公告 ${announcement.key} 已更新。`,
        },
      ],
    };
  }
}

function toUpdateSiteAnnouncementInput(payload: Record<string, unknown>) {
  const id = toRequiredString(payload.announcementId, "announcementId");

  return {
    command: toOptionalString(payload.command),
    icon: toOptionalString(payload.icon),
    iconClassName: toOptionalString(payload.iconClassName),
    id,
    isEnabled: toOptionalBoolean(payload.isEnabled),
    output: toOptionalString(payload.output),
    process: toOptionalString(payload.process),
    sortOrder: toOptionalNumber(payload.sortOrder),
    status: toOptionalString(payload.status),
    title: toOptionalString(payload.title),
  };
}

function toRequiredString(value: unknown, fieldName: string) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw new AdminAgentWorkflowActionValidationError(`Site config action requires ${fieldName}.`);
  }

  return normalized;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export { SiteConfigAgentActionHandler };
