import type { AdminAgentFinding, AdminAgentFindingCategory } from "./admin-agent-finding.entity";

type AdminAgentAutomationPolicyMode = "MANUAL_REVIEW";

type AdminAgentAutomationPolicy = {
  mode: AdminAgentAutomationPolicyMode;
  autoHideEnabled: boolean;
  eligibleCategories: AdminAgentFindingCategory[];
  confidenceThreshold: number;
  requiresStrongEvidence: boolean;
};

type AdminAgentAutomationPolicyInput = Partial<AdminAgentAutomationPolicy> | null | undefined;
type AdminAgentAutomationAction = "AUTO_HIDE_COMMENT";
type AdminAgentAutomationEligibilityResult =
  | {
      action: AdminAgentAutomationAction;
      eligible: true;
    }
  | {
      eligible: false;
      reason: string;
    };

const defaultAdminAgentAutomationPolicy: AdminAgentAutomationPolicy = {
  mode: "MANUAL_REVIEW",
  autoHideEnabled: false,
  eligibleCategories: ["SPAM", "ABUSE"],
  confidenceThreshold: 0.95,
  requiresStrongEvidence: true,
};

function getDefaultAdminAgentAutomationPolicy(): AdminAgentAutomationPolicy {
  return copyAdminAgentAutomationPolicy(defaultAdminAgentAutomationPolicy);
}

function normalizeAdminAgentAutomationPolicy(
  input: AdminAgentAutomationPolicyInput,
): AdminAgentAutomationPolicy {
  return {
    mode: "MANUAL_REVIEW",
    autoHideEnabled: false,
    eligibleCategories: normalizeEligibleCategories(input?.eligibleCategories),
    confidenceThreshold: normalizeConfidenceThreshold(input?.confidenceThreshold),
    requiresStrongEvidence: input?.requiresStrongEvidence ?? true,
  };
}

function evaluateAdminAgentAutomationEligibility(
  finding: AdminAgentFinding,
  policy: AdminAgentAutomationPolicy,
): AdminAgentAutomationEligibilityResult {
  if (finding.status !== "PENDING") {
    return deny("Only pending findings can be automated.");
  }

  if (finding.targetType !== "ARTICLE_COMMENT" || finding.proposedAction !== "HIDE_COMMENT") {
    return deny("Only hide-comment findings can be automated.");
  }

  if (!policy.eligibleCategories.includes(finding.category)) {
    return deny("Finding category is not eligible for automation.");
  }

  if (finding.confidence < policy.confidenceThreshold) {
    return deny("Finding confidence is below the automation threshold.");
  }

  if (policy.requiresStrongEvidence && !hasStrongAutomationEvidence(finding)) {
    return deny("Finding does not include strong automation evidence.");
  }

  return {
    action: "AUTO_HIDE_COMMENT",
    eligible: true,
  };
}

function copyAdminAgentAutomationPolicy(
  policy: AdminAgentAutomationPolicy,
): AdminAgentAutomationPolicy {
  return {
    ...policy,
    eligibleCategories: [...policy.eligibleCategories],
  };
}

function normalizeEligibleCategories(
  categories: AdminAgentFindingCategory[] | undefined,
): AdminAgentFindingCategory[] {
  const allowedCategories = new Set<AdminAgentFindingCategory>(["SPAM", "ABUSE"]);
  const normalized = [
    ...new Set((categories ?? []).filter((category) => allowedCategories.has(category))),
  ];

  return normalized.length > 0
    ? normalized
    : [...defaultAdminAgentAutomationPolicy.eligibleCategories];
}

function normalizeConfidenceThreshold(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultAdminAgentAutomationPolicy.confidenceThreshold;
  }

  return Math.min(1, Math.max(0.5, Number(value.toFixed(2))));
}

function hasStrongAutomationEvidence(finding: AdminAgentFinding) {
  const patterns = strongEvidencePatternsByCategory[finding.category] ?? [];

  if (patterns.length === 0) {
    return false;
  }

  return finding.evidence.some((evidence) => patterns.some((pattern) => pattern.test(evidence)));
}

const strongEvidencePatternsByCategory: Partial<Record<AdminAgentFindingCategory, RegExp[]>> = {
  ABUSE: [/人身攻击/u, /辱骂/u, /侮辱/u, /威胁/u, /恐吓/u, /傻逼/u, /白痴/u, /去死/u],
  SPAM: [
    /广告/u,
    /推广/u,
    /引流/u,
    /加微信/u,
    /联系方式/u,
    /返利/u,
    /代理/u,
    /兼职/u,
    /赚钱/u,
    /https?:\/\//iu,
    /www\./iu,
  ],
};

function deny(reason: string): AdminAgentAutomationEligibilityResult {
  return {
    eligible: false,
    reason,
  };
}

export {
  evaluateAdminAgentAutomationEligibility,
  getDefaultAdminAgentAutomationPolicy,
  normalizeAdminAgentAutomationPolicy,
};
export type {
  AdminAgentAutomationAction,
  AdminAgentAutomationEligibilityResult,
  AdminAgentAutomationPolicy,
  AdminAgentAutomationPolicyInput,
  AdminAgentAutomationPolicyMode,
};
