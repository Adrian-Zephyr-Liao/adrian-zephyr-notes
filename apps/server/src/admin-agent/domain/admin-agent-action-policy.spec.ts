import { describe, expect, it } from "vitest";
import type { AdminAgentFinding } from "./admin-agent-finding.entity";
import { evaluateAdminAgentFindingActionPolicy } from "./admin-agent-action-policy";

describe("evaluateAdminAgentFindingActionPolicy", () => {
  it("allows pending hide-comment findings to be executed", () => {
    expect(
      evaluateAdminAgentFindingActionPolicy(createFinding(), "EXECUTE_PROPOSED_ACTION"),
    ).toEqual({
      action: "HIDE_COMMENT",
      allowed: true,
    });
  });

  it("allows pending findings to be rejected", () => {
    expect(evaluateAdminAgentFindingActionPolicy(createFinding(), "REJECT")).toEqual({
      action: "REJECT_FINDING",
      allowed: true,
    });
  });

  it("allows executed hide-comment findings to be restored", () => {
    expect(
      evaluateAdminAgentFindingActionPolicy(
        createFinding({
          status: "EXECUTED",
        }),
        "RESTORE_COMMENT",
      ),
    ).toEqual({
      action: "RESTORE_COMMENT",
      allowed: true,
    });
  });

  it("allows rejected, restored, and failed hide-comment findings to be executed again", () => {
    for (const status of ["FAILED", "REJECTED", "RESTORED"] satisfies Array<
      AdminAgentFinding["status"]
    >) {
      expect(
        evaluateAdminAgentFindingActionPolicy(
          createFinding({
            status,
          }),
          "EXECUTE_PROPOSED_ACTION",
        ),
      ).toEqual({
        action: "HIDE_COMMENT",
        allowed: true,
      });
    }
  });

  it("denies execution for non-pending findings", () => {
    expect(
      evaluateAdminAgentFindingActionPolicy(
        createFinding({
          status: "EXECUTED",
        }),
        "EXECUTE_PROPOSED_ACTION",
      ),
    ).toEqual({
      allowed: false,
      reason: "Only pending, failed, rejected, or restored findings can be executed.",
    });
  });

  it("denies unsupported proposed actions", () => {
    expect(
      evaluateAdminAgentFindingActionPolicy(
        createFinding({
          proposedAction: "NO_ACTION",
        }),
        "EXECUTE_PROPOSED_ACTION",
      ),
    ).toEqual({
      allowed: false,
      reason: "Unsupported admin agent proposed action.",
    });
  });
});

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "SPAM",
    confidence: 0.92,
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
