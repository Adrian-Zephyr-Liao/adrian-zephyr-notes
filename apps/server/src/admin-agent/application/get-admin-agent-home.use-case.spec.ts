import { describe, expect, it } from "vitest";
import type {
  AdminAgentHomeRepository,
  GetAdminAgentHomeSnapshotInput,
} from "../domain/admin-agent-home.repository";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import type { AdminAgentAutomationPolicy } from "../domain/admin-agent-automation-policy";
import type { AdminAgentAutomationPolicyRepository } from "../domain/admin-agent-automation-policy.repository";
import {
  countAutomationCandidates,
  createAssistantBrief,
  GetAdminAgentHomeUseCase,
} from "./get-admin-agent-home.use-case";

describe("GetAdminAgentHomeUseCase", () => {
  it("loads the home snapshot for the current local day", async () => {
    const repository = new StaticAdminAgentHomeRepository();
    const useCase = new GetAdminAgentHomeUseCase(
      repository,
      new StaticAdminAgentAutomationPolicyRepository(),
    );

    const result = await useCase.execute(new Date("2026-07-04T10:30:00.000Z"));

    expect(result.todayCommentCount).toBe(3);
    expect(result.pendingFindingCount).toBe(0);
    expect(result.automationCandidateCount).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.capabilities.map((capability) => capability.id)).toEqual([
      "comments",
      "articles",
      "guestbook",
      "site",
      "audit",
    ]);
    expect(result.tasks.map((task) => task.taskName)).toEqual([
      "comment_moderation_analysis",
      "article_assistance",
      "site_config_review",
      "audit_review",
      "multi_task_orchestration",
    ]);
    expect(result.automationPolicy).toEqual({
      autoHideEnabled: false,
      confidenceThreshold: 0.95,
      eligibleCategories: ["SPAM", "ABUSE"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    });
    expect(repository.input?.todayStart.getHours()).toBe(0);
    expect(repository.input?.todayStart.getMinutes()).toBe(0);
    expect(repository.input?.todayEnd.getTime()).toBe(
      repository.input!.todayStart.getTime() + 24 * 60 * 60 * 1000,
    );
    expect(repository.input?.recentActionLimit).toBe(5);
  });

  it("creates an empty-day brief without claiming analysis happened", () => {
    expect(
      createAssistantBrief({
        executedActionCount: 0,
        findings: [],
        pendingFindingCount: 0,
        recentActions: [],
        todayCommentCount: 0,
        todayHiddenCommentCount: 0,
        todayVisibleCommentCount: 0,
      }),
    ).toContain("今天还没有新增文章评论");
  });

  it("counts automation candidates from the current site policy", () => {
    expect(
      countAutomationCandidates(
        {
          findings: [
            createFinding({
              confidence: 0.98,
              evidence: ["评论包含广告引流话术。"],
            }),
            createFinding({
              id: "finding-2",
              confidence: 0.82,
            }),
          ],
        },
        {
          autoHideEnabled: true,
          confidenceThreshold: 0.95,
          eligibleCategories: ["SPAM", "ABUSE"],
          mode: "MANUAL_REVIEW",
          requiresStrongEvidence: true,
        },
      ),
    ).toBe(1);
  });

  it("counts candidates even when automatic execution is disabled", () => {
    expect(
      countAutomationCandidates(
        {
          findings: [
            createFinding({
              confidence: 0.98,
              evidence: ["评论包含广告引流话术。"],
            }),
          ],
        },
        {
          autoHideEnabled: false,
          confidenceThreshold: 0.95,
          eligibleCategories: ["SPAM", "ABUSE"],
          mode: "MANUAL_REVIEW",
          requiresStrongEvidence: true,
        },
      ),
    ).toBe(1);
  });
});

class StaticAdminAgentHomeRepository implements AdminAgentHomeRepository {
  input: GetAdminAgentHomeSnapshotInput | null = null;

  async getHomeSnapshot(input: GetAdminAgentHomeSnapshotInput) {
    this.input = input;

    return {
      executedActionCount: 1,
      findings: [],
      pendingFindingCount: 0,
      recentActions: [],
      todayCommentCount: 3,
      todayHiddenCommentCount: 1,
      todayVisibleCommentCount: 2,
    };
  }
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "SPAM",
    confidence: 0.98,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
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
    updatedAt: new Date("2026-07-04T03:00:00.000Z"),
    ...overrides,
  };
}

class StaticAdminAgentAutomationPolicyRepository implements AdminAgentAutomationPolicyRepository {
  async getPolicy(): Promise<AdminAgentAutomationPolicy> {
    return {
      autoHideEnabled: false,
      confidenceThreshold: 0.95,
      eligibleCategories: ["SPAM", "ABUSE"],
      mode: "MANUAL_REVIEW" as const,
      requiresStrongEvidence: true,
    };
  }
}
