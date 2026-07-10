import type { AdminAgentGenericApprovalRequest } from "./admin-agent-workflow-approval";
import { toBusinessApprovalOutput } from "./admin-agent-workflow-approval";

type AdminAgentSiteConfigApprovalAction = "REVIEW_SITE_CONFIG" | "UPDATE_SITE_ANNOUNCEMENT";

type AdminAgentSiteConfigApprovalRequest = AdminAgentGenericApprovalRequest & {
  action: AdminAgentSiteConfigApprovalAction;
  subject: "SITE_CONFIG";
};

function createSiteConfigApprovalRequest(
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  summary = "站点配置巡检需要管理员确认。",
): AdminAgentSiteConfigApprovalRequest {
  const action = toSiteConfigApprovalAction(input);

  return {
    action,
    payload: toSiteConfigApprovalPayload(action, input, output),
    question: toSiteConfigApprovalQuestion(action),
    subject: "SITE_CONFIG",
    summary,
  };
}

function toSiteConfigApprovalAction(
  input: Record<string, unknown>,
): AdminAgentSiteConfigApprovalAction {
  return input.proposedAction === "UPDATE_SITE_ANNOUNCEMENT"
    ? "UPDATE_SITE_ANNOUNCEMENT"
    : "REVIEW_SITE_CONFIG";
}

function toSiteConfigApprovalPayload(
  action: AdminAgentSiteConfigApprovalAction,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
) {
  if (action === "UPDATE_SITE_ANNOUNCEMENT") {
    return isPlainSiteConfigApprovalRecord(input.actionPayload) ? input.actionPayload : {};
  }

  return {
    output: toBusinessApprovalOutput(output),
  };
}

function toSiteConfigApprovalQuestion(action: AdminAgentSiteConfigApprovalAction) {
  return action === "UPDATE_SITE_ANNOUNCEMENT"
    ? "是否确认执行这次站点公告更新？"
    : "是否确认这次站点配置巡检结果？";
}

function isPlainSiteConfigApprovalRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export { createSiteConfigApprovalRequest };
export type { AdminAgentSiteConfigApprovalAction, AdminAgentSiteConfigApprovalRequest };
