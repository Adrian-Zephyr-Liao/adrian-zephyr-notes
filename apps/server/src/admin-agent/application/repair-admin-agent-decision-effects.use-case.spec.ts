import { describe, expect, it, vi } from "vitest";
import type { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import type { AdminAgentDecisionEffect } from "../domain/admin-agent-decision-effect.entity";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import { RepairAdminAgentDecisionEffectsUseCase } from "./repair-admin-agent-decision-effects.use-case";

describe("RepairAdminAgentDecisionEffectsUseCase", () => {
  it("repairs failed finding-decision audit effects", async () => {
    const repository = createRepositoryDouble([
      createEffect({
        payload: {
          actor: { id: "admin-1", login: "adrian" },
          decision: "EXECUTE_PROPOSED_ACTION",
          findingId: "finding-1",
          requestContext: { ipAddress: "127.0.0.1", userAgent: "Vitest" },
          targetId: "comment-1",
        },
        status: "FAILED",
        type: "FINDING_DECISION_AUDIT",
      }),
    ]);
    const recordAudit = createRecordAuditDouble();
    const useCase = new RepairAdminAgentDecisionEffectsUseCase(repository, recordAudit);

    await expect(useCase.execute({ runId: "run-1" })).resolves.toEqual({
      failedCount: 0,
      repairedCount: 1,
      skippedCount: 0,
    });

    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        metadata: expect.objectContaining({
          agentFindingId: "finding-1",
          effectKey: "effect-key-1",
        }),
        requestContext: {
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
        },
        resourceId: "comment-1",
      }),
    );
    expect(repository.markDecisionEffectSucceeded).toHaveBeenCalledWith("effect-1");
  });

  it("repairs run completion effects only when no findings are still pending", async () => {
    const repository = createRepositoryDouble(
      [
        createEffect({
          type: "RUN_COMPLETION",
        }),
      ],
      [
        createFinding({ status: "EXECUTED" }),
        createFinding({ id: "finding-2", status: "REJECTED" }),
      ],
      createRun({ status: "RUNNING" }),
    );
    const useCase = new RepairAdminAgentDecisionEffectsUseCase(
      repository,
      createRecordAuditDouble(),
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      repairedCount: 1,
      skippedCount: 0,
    });

    expect(repository.completeRun).toHaveBeenCalledWith("run-1", "所有 Agent 风险建议均已处理。");
    expect(repository.markDecisionEffectSucceeded).toHaveBeenCalledWith("effect-1");
  });

  it("treats run-completion effects as repaired when the run is already completed", async () => {
    const repository = createRepositoryDouble([
      createEffect({
        type: "RUN_COMPLETION",
      }),
    ]);
    const useCase = new RepairAdminAgentDecisionEffectsUseCase(
      repository,
      createRecordAuditDouble(),
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      repairedCount: 1,
      skippedCount: 0,
    });

    expect(repository.listFindingsByRunId).not.toHaveBeenCalled();
    expect(repository.completeRun).not.toHaveBeenCalled();
    expect(repository.markDecisionEffectSucceeded).toHaveBeenCalledWith("effect-1");
  });

  it("keeps run completion effects repairable while sibling findings are pending", async () => {
    const repository = createRepositoryDouble(
      [
        createEffect({
          type: "RUN_COMPLETION",
        }),
      ],
      [
        createFinding({ status: "EXECUTED" }),
        createFinding({ id: "finding-2", status: "PENDING" }),
      ],
      createRun({ status: "RUNNING" }),
    );
    const useCase = new RepairAdminAgentDecisionEffectsUseCase(
      repository,
      createRecordAuditDouble(),
    );

    await expect(useCase.execute()).resolves.toEqual({
      failedCount: 0,
      repairedCount: 0,
      skippedCount: 1,
    });

    expect(repository.completeRun).not.toHaveBeenCalled();
    expect(repository.markDecisionEffectSucceeded).not.toHaveBeenCalled();
  });

  it("records repair failures for later retry", async () => {
    const repository = createRepositoryDouble([
      createEffect({
        payload: {
          actor: { id: "admin-1", login: "adrian" },
          decision: "REJECT",
          findingId: "finding-1",
          targetId: "comment-1",
        },
        type: "FINDING_DECISION_AUDIT",
      }),
    ]);
    const recordAudit = createRecordAuditDouble();
    recordAudit.execute.mockRejectedValueOnce(new Error("audit unavailable"));
    const useCase = new RepairAdminAgentDecisionEffectsUseCase(repository, recordAudit);

    await expect(useCase.execute()).resolves.toEqual({
      failedCount: 1,
      repairedCount: 0,
      skippedCount: 0,
    });

    expect(repository.markDecisionEffectFailed).toHaveBeenCalledWith(
      "effect-1",
      "audit unavailable",
    );
  });
});

function createRepositoryDouble(
  effects: AdminAgentDecisionEffect[],
  findings: AdminAgentFinding[] = [],
  run: AdminAgentRun | null = createRun(),
) {
  return {
    completeRun: vi.fn().mockResolvedValue(createRun()),
    findRunById: vi.fn().mockResolvedValue(run),
    listFindingsByRunId: vi.fn().mockResolvedValue(findings),
    listRepairableDecisionEffects: vi.fn().mockResolvedValue(effects),
    markDecisionEffectFailed: vi.fn().mockResolvedValue(effects[0]),
    markDecisionEffectSucceeded: vi.fn().mockResolvedValue(effects[0]),
  } as unknown as AdminAgentRepository & {
    completeRun: ReturnType<typeof vi.fn>;
    findRunById: ReturnType<typeof vi.fn>;
    listFindingsByRunId: ReturnType<typeof vi.fn>;
    listRepairableDecisionEffects: ReturnType<typeof vi.fn>;
    markDecisionEffectFailed: ReturnType<typeof vi.fn>;
    markDecisionEffectSucceeded: ReturnType<typeof vi.fn>;
  };
}

function createRecordAuditDouble() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordAdminOperationUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createEffect(overrides: Partial<AdminAgentDecisionEffect> = {}): AdminAgentDecisionEffect {
  return {
    attempts: 1,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    effectKey: "effect-key-1",
    errorMessage: "previous failure",
    findingId: "finding-1",
    id: "effect-1",
    payload: {
      findingId: "finding-1",
      findingStatus: "EXECUTED",
      runId: "run-1",
    },
    runId: "run-1",
    status: "FAILED",
    type: "RUN_COMPLETION",
    updatedAt: new Date("2026-07-04T10:01:00.000Z"),
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "SPAM",
    confidence: 0.92,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    evidence: ["spam"],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "spam",
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

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 0,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    currentNode: "completed",
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "admin-1",
    status: "COMPLETED",
    summary: "done",
    threadId: null,
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
