import type { AdminAgentFinding } from "./admin-agent-finding.entity";

type AdminAgentFindingDecision = "EXECUTE_PROPOSED_ACTION" | "REJECT" | "RESTORE_COMMENT";
type AdminAgentFindingAction = "HIDE_COMMENT" | "REJECT_FINDING" | "RESTORE_COMMENT";

type AdminAgentFindingActionPolicyResult =
  | {
      action: AdminAgentFindingAction;
      allowed: true;
    }
  | {
      allowed: false;
      reason: string;
    };

function evaluateAdminAgentFindingActionPolicy(
  finding: AdminAgentFinding,
  decision: AdminAgentFindingDecision,
): AdminAgentFindingActionPolicyResult {
  if (decision === "REJECT") {
    if (finding.status !== "PENDING") {
      return deny("Only pending findings can be rejected.");
    }

    return allow("REJECT_FINDING");
  }

  if (decision === "RESTORE_COMMENT") {
    if (finding.status !== "EXECUTED") {
      return deny("Only executed findings can be restored.");
    }

    if (finding.targetType !== "ARTICLE_COMMENT" || finding.proposedAction !== "HIDE_COMMENT") {
      return deny("Unsupported admin agent restore action.");
    }

    return allow("RESTORE_COMMENT");
  }

  if (
    finding.status !== "PENDING" &&
    finding.status !== "FAILED" &&
    finding.status !== "REJECTED" &&
    finding.status !== "RESTORED"
  ) {
    return deny("Only pending, failed, rejected, or restored findings can be executed.");
  }

  if (finding.targetType !== "ARTICLE_COMMENT" || finding.proposedAction !== "HIDE_COMMENT") {
    return deny("Unsupported admin agent proposed action.");
  }

  return allow("HIDE_COMMENT");
}

function allow(action: AdminAgentFindingAction): AdminAgentFindingActionPolicyResult {
  return {
    action,
    allowed: true,
  };
}

function deny(reason: string): AdminAgentFindingActionPolicyResult {
  return {
    allowed: false,
    reason,
  };
}

export { evaluateAdminAgentFindingActionPolicy };
export type {
  AdminAgentFindingAction,
  AdminAgentFindingActionPolicyResult,
  AdminAgentFindingDecision,
};
