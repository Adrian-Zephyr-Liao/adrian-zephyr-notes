import { describe, expect, it, vi } from "vitest";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import {
  AdminAgentCommentAnalysisSelectionError,
  ModerateAdminAgentCommentAnalysisUseCase,
} from "./moderate-admin-agent-comment-analysis.use-case";

describe("ModerateAdminAgentCommentAnalysisUseCase", () => {
  it("accepts a reused pending finding recorded in the requested analysis output", async () => {
    const analysis = createAnalysis({
      id: "current-analysis",
      output: {
        analyzedCount: 1,
        findingIds: ["existing-finding"],
        scope: "selection",
      },
    });
    const pendingFinding = createFinding({
      id: "existing-finding",
      runId: "previous-analysis",
    });
    const executedFinding = createFinding({
      id: "existing-finding",
      runId: "previous-analysis",
      status: "EXECUTED",
    });
    const repository = createRepository({
      analysis,
      findingsAfterDecision: [executedFinding],
      requestedFindings: [pendingFinding],
    });
    const decideAdminAgentFindings = {
      execute: vi.fn().mockResolvedValue({
        results: [{ findingId: "existing-finding", status: "APPLIED" }],
      }),
    };
    const useCase = new ModerateAdminAgentCommentAnalysisUseCase(
      decideAdminAgentFindings as never,
      repository,
    );

    const result = await useCase.execute({
      action: "HIDE",
      actor: { id: "admin-1", login: "adrian" },
      analysisId: analysis.id,
      findingIds: [pendingFinding.id],
    });

    expect(decideAdminAgentFindings.execute).toHaveBeenCalledWith({
      actor: { id: "admin-1", login: "adrian" },
      decisions: [
        {
          decision: "EXECUTE_PROPOSED_ACTION",
          findingId: pendingFinding.id,
        },
      ],
      requestContext: undefined,
    });
    expect(repository.listFindingsByIds).toHaveBeenNthCalledWith(2, ["existing-finding"]);
    expect(repository.listFindingsByRunId).not.toHaveBeenCalled();
    expect(result.findings).toEqual([executedFinding]);
  });

  it("rejects a finding that is not recorded in the requested analysis output", async () => {
    const analysis = createAnalysis({
      id: "current-analysis",
      output: {
        analyzedCount: 1,
        findingIds: ["allowed-finding"],
        scope: "selection",
      },
    });
    const unlistedFinding = createFinding({
      id: "unlisted-finding",
      runId: analysis.id,
    });
    const repository = createRepository({
      analysis,
      requestedFindings: [unlistedFinding],
    });
    const decideAdminAgentFindings = {
      execute: vi.fn(),
    };
    const useCase = new ModerateAdminAgentCommentAnalysisUseCase(
      decideAdminAgentFindings as never,
      repository,
    );

    await expect(
      useCase.execute({
        action: "HIDE",
        actor: { id: "admin-1", login: "adrian" },
        analysisId: analysis.id,
        findingIds: [unlistedFinding.id],
      }),
    ).rejects.toBeInstanceOf(AdminAgentCommentAnalysisSelectionError);

    expect(decideAdminAgentFindings.execute).not.toHaveBeenCalled();
  });
});

function createRepository(input: {
  analysis: AdminAgentRun;
  findingsAfterDecision?: AdminAgentFinding[];
  requestedFindings: AdminAgentFinding[];
}) {
  return {
    findRunById: vi.fn().mockResolvedValue(input.analysis),
    listFindingsByIds: vi
      .fn()
      .mockResolvedValueOnce(input.requestedFindings)
      .mockResolvedValueOnce(input.findingsAfterDecision ?? input.requestedFindings),
    listFindingsByRunId: vi.fn(),
  } as unknown as AdminAgentRepository & {
    listFindingsByIds: ReturnType<typeof vi.fn>;
    listFindingsByRunId: ReturnType<typeof vi.fn>;
  };
}

function createAnalysis(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-24T12:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "analysis-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "admin-1",
    status: "COMPLETED",
    summary: "识别出 1 条高风险评论。",
    threadId: "analysis-1",
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-24T12:00:01.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "ABUSE",
    confidence: 0.92,
    createdAt: new Date("2026-07-24T12:00:00.000Z"),
    evidence: ["侮辱性表达"],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "评论包含侮辱性表达。",
    runId: "analysis-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-24T12:00:00.000Z"),
    ...overrides,
  };
}
