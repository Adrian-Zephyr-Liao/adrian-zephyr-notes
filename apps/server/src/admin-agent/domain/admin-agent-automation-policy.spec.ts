import { describe, expect, it } from "vitest";
import type { AdminAgentFinding } from "./admin-agent-finding.entity";
import {
  evaluateAdminAgentAutomationEligibility,
  getDefaultAdminAgentAutomationPolicy,
  normalizeAdminAgentAutomationPolicy,
  type AdminAgentAutomationPolicy,
} from "./admin-agent-automation-policy";

describe("getDefaultAdminAgentAutomationPolicy", () => {
  it("keeps automatic hiding disabled until a site policy explicitly enables it", () => {
    expect(getDefaultAdminAgentAutomationPolicy()).toEqual({
      autoHideEnabled: false,
      confidenceThreshold: 0.95,
      eligibleCategories: ["SPAM", "ABUSE"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    });
  });

  it("returns an immutable copy of category configuration", () => {
    const policy = getDefaultAdminAgentAutomationPolicy();

    policy.eligibleCategories.push("OTHER");

    expect(getDefaultAdminAgentAutomationPolicy().eligibleCategories).toEqual(["SPAM", "ABUSE"]);
  });

  it("normalizes site-level policy input while keeping automatic hiding disabled", () => {
    expect(
      normalizeAdminAgentAutomationPolicy({
        autoHideEnabled: true,
        confidenceThreshold: 1.2,
        eligibleCategories: ["SPAM", "OTHER"],
        mode: "MANUAL_REVIEW",
        requiresStrongEvidence: false,
      }),
    ).toEqual({
      autoHideEnabled: false,
      confidenceThreshold: 1,
      eligibleCategories: ["SPAM"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: false,
    });
  });
});

describe("evaluateAdminAgentAutomationEligibility", () => {
  it("marks high-confidence pending spam findings with strong evidence as candidates", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          confidence: 0.98,
          evidence: ["评论包含广告引流话术。"],
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });

  it("keeps candidate evaluation available while automatic execution is disabled", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(createFinding(), {
        ...createEnabledPolicy(),
        autoHideEnabled: false,
      }),
    ).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });

  it("denies non-pending findings", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          status: "EXECUTED",
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      eligible: false,
      reason: "Only pending findings can be automated.",
    });
  });

  it("denies findings without a hide-comment action", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          proposedAction: "NO_ACTION",
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      eligible: false,
      reason: "Only hide-comment findings can be automated.",
    });
  });

  it("denies categories outside the configured automation allow list", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          category: "HARASSMENT",
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      eligible: false,
      reason: "Finding category is not eligible for automation.",
    });
  });

  it("denies findings below the configured confidence threshold", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          confidence: 0.94,
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      eligible: false,
      reason: "Finding confidence is below the automation threshold.",
    });
  });

  it("requires strong evidence when the policy enables the evidence gate", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          evidence: ["评论语气较差。"],
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      eligible: false,
      reason: "Finding does not include strong automation evidence.",
    });
  });

  it("can skip the strong evidence gate when the policy explicitly disables it", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          evidence: ["评论语气较差。"],
        }),
        {
          ...createEnabledPolicy(),
          requiresStrongEvidence: false,
        },
      ),
    ).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });

  it("allows high-confidence abuse findings with strong evidence", () => {
    expect(
      evaluateAdminAgentAutomationEligibility(
        createFinding({
          category: "ABUSE",
          confidence: 0.99,
          evidence: ["证据命中人身攻击和辱骂。"],
        }),
        createEnabledPolicy(),
      ),
    ).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });
});

function createEnabledPolicy(
  overrides: Partial<AdminAgentAutomationPolicy> = {},
): AdminAgentAutomationPolicy {
  return {
    autoHideEnabled: true,
    confidenceThreshold: 0.95,
    eligibleCategories: ["SPAM", "ABUSE"],
    mode: "MANUAL_REVIEW",
    requiresStrongEvidence: true,
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "SPAM",
    confidence: 0.98,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    evidence: ["广告"],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "疑似广告评论。",
    runId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    ...overrides,
  };
}
