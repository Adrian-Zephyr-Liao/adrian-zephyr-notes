import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import type { AdminOperationActor } from "../../audit/domain/admin-operation-log";
import type { AdminArticleCommentListItem } from "../../comments/domain/admin-article-comment.repository";
import type { UpdateAdminArticleCommentStatusUseCase } from "../../comments/application/update-admin-article-comment-status.use-case";
import type {
  AdminAgentFinding,
  AdminAgentFindingDraft,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentCommentForAnalysis } from "../domain/admin-agent-comment-analysis";
import type {
  AdminAgentDecisionEffect,
  EnsureAdminAgentDecisionEffectInput,
} from "../domain/admin-agent-decision-effect.entity";
import type {
  AdminAgentRepository,
  CreateAdminAgentRunInput,
  ListRecentVisibleCommentsForAnalysisInput,
  ListTodayVisibleCommentsForAnalysisInput,
} from "../domain/admin-agent.repository";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import { AdminAgentFindingDecisionError } from "./admin-agent-finding.errors";
import { DecideAdminAgentFindingUseCase } from "./decide-admin-agent-finding.use-case";

describe("DecideAdminAgentFindingUseCase", () => {
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it("executes a hide-comment finding through the comment application use case", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const recordAudit = createRecordAuditDouble();
    const updateComment = createUpdateCommentDouble();
    const useCase = new DecideAdminAgentFindingUseCase(repository, recordAudit, updateComment);

    const result = await useCase.execute({
      actor: createActor(),
      decision: "EXECUTE_PROPOSED_ACTION",
      findingId: "finding-1",
    });

    expect(updateComment.execute).toHaveBeenCalledWith({
      id: "comment-1",
      status: "HIDDEN",
    });
    expect(result.finding.status).toBe("EXECUTED");
    expect(result.updatedComment?.status).toBe("HIDDEN");
    expect(repository.completedRunSummary).toBe("所有 Agent 风险建议均已处理。");
    expect(repository.decisionEffects.map((effect) => [effect.type, effect.status])).toEqual([
      ["FINDING_DECISION_AUDIT", "SUCCEEDED"],
      ["COMMENT_STATUS_AUDIT", "SUCCEEDED"],
      ["RUN_COMPLETION", "SUCCEEDED"],
    ]);
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        metadata: expect.objectContaining({
          agentFindingId: "finding-1",
          decision: "EXECUTE_PROPOSED_ACTION",
        }),
        resourceId: "comment-1",
      }),
    );
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMMENT_STATUS_UPDATED",
        metadata: expect.objectContaining({
          agentFindingId: "finding-1",
          source: "admin_agent",
          status: "HIDDEN",
        }),
        resourceId: "comment-1",
      }),
    );
  });

  it("rejects a pending finding without updating the comment", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const recordAudit = createRecordAuditDouble();
    const updateComment = createUpdateCommentDouble();
    const useCase = new DecideAdminAgentFindingUseCase(repository, recordAudit, updateComment);

    const result = await useCase.execute({
      actor: createActor(),
      decision: "REJECT",
      findingId: "finding-1",
    });

    expect(updateComment.execute).not.toHaveBeenCalled();
    expect(result.finding.status).toBe("REJECTED");
    expect(repository.completedRunSummary).toBe("所有 Agent 风险建议均已处理。");
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        resourceId: "comment-1",
      }),
    );
  });

  it("executes a previously rejected finding when the admin judges it again", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "REJECTED" }));
    const recordAudit = createRecordAuditDouble();
    const updateComment = createUpdateCommentDouble();
    const useCase = new DecideAdminAgentFindingUseCase(repository, recordAudit, updateComment);

    const result = await useCase.execute({
      actor: createActor(),
      decision: "EXECUTE_PROPOSED_ACTION",
      findingId: "finding-1",
    });

    expect(updateComment.execute).toHaveBeenCalledWith({
      id: "comment-1",
      status: "HIDDEN",
    });
    expect(result.finding.status).toBe("EXECUTED");
    expect(result.updatedComment?.status).toBe("HIDDEN");
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        metadata: expect.objectContaining({
          agentFindingId: "finding-1",
          decision: "EXECUTE_PROPOSED_ACTION",
        }),
      }),
    );
  });

  it("returns the applied result when the decision audit fails after executing the finding", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const recordAudit = createRecordAuditDouble();
    recordAudit.execute.mockRejectedValueOnce(new Error("Audit write failed."));
    const useCase = new DecideAdminAgentFindingUseCase(
      repository,
      recordAudit,
      createUpdateCommentDouble(),
    );

    const result = await useCase.execute({
      actor: createActor(),
      decision: "EXECUTE_PROPOSED_ACTION",
      findingId: "finding-1",
    });

    expect(result.finding.status).toBe("EXECUTED");
    expect(result.updatedComment?.status).toBe("HIDDEN");
    expect(repository.statusHistory).toEqual(["EXECUTED"]);
    expect(repository.decisionEffects.map((effect) => [effect.type, effect.status])).toEqual([
      ["FINDING_DECISION_AUDIT", "FAILED"],
      ["COMMENT_STATUS_AUDIT", "SUCCEEDED"],
      ["RUN_COMPLETION", "SUCCEEDED"],
    ]);
  });

  it("returns the applied result when the comment status audit fails after executing the finding", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const recordAudit = createRecordAuditDouble();
    recordAudit.execute
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Comment status audit write failed."));
    const useCase = new DecideAdminAgentFindingUseCase(
      repository,
      recordAudit,
      createUpdateCommentDouble(),
    );

    const result = await useCase.execute({
      actor: createActor(),
      decision: "EXECUTE_PROPOSED_ACTION",
      findingId: "finding-1",
    });

    expect(result.finding.status).toBe("EXECUTED");
    expect(result.updatedComment?.status).toBe("HIDDEN");
    expect(repository.statusHistory).toEqual(["EXECUTED"]);
    expect(repository.decisionEffects.map((effect) => [effect.type, effect.status])).toEqual([
      ["FINDING_DECISION_AUDIT", "SUCCEEDED"],
      ["COMMENT_STATUS_AUDIT", "FAILED"],
      ["RUN_COMPLETION", "SUCCEEDED"],
    ]);
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
      }),
    );
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMMENT_STATUS_UPDATED",
      }),
    );
  });

  it("returns the rejected result when decision audit fails after rejecting the finding", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const recordAudit = createRecordAuditDouble();
    recordAudit.execute.mockRejectedValueOnce(new Error("Audit write failed."));
    const useCase = new DecideAdminAgentFindingUseCase(
      repository,
      recordAudit,
      createUpdateCommentDouble(),
    );

    const result = await useCase.execute({
      actor: createActor(),
      decision: "REJECT",
      findingId: "finding-1",
    });

    expect(result.finding.status).toBe("REJECTED");
    expect(repository.statusHistory).toEqual(["REJECTED"]);
    expect(repository.decisionEffects.map((effect) => [effect.type, effect.status])).toEqual([
      ["FINDING_DECISION_AUDIT", "FAILED"],
      ["RUN_COMPLETION", "SUCCEEDED"],
    ]);
  });

  it("still marks the finding failed when the core comment update fails", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }));
    const updateComment = createUpdateCommentDouble();
    updateComment.execute.mockRejectedValueOnce(new Error("Comment update failed."));
    const useCase = new DecideAdminAgentFindingUseCase(
      repository,
      createRecordAuditDouble(),
      updateComment,
    );

    await expect(
      useCase.execute({
        actor: createActor(),
        decision: "EXECUTE_PROPOSED_ACTION",
        findingId: "finding-1",
      }),
    ).rejects.toThrow("Comment update failed.");

    expect(repository.statusHistory).toEqual(["FAILED"]);
  });

  it("restores an executed hide-comment finding through the comment application use case", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "EXECUTED" }));
    const recordAudit = createRecordAuditDouble();
    const updateComment = createUpdateCommentDouble(
      createComment({
        status: "VISIBLE",
      }),
    );
    const useCase = new DecideAdminAgentFindingUseCase(repository, recordAudit, updateComment);

    const result = await useCase.execute({
      actor: createActor(),
      decision: "RESTORE_COMMENT",
      findingId: "finding-1",
    });

    expect(updateComment.execute).toHaveBeenCalledWith({
      id: "comment-1",
      status: "VISIBLE",
    });
    expect(result.finding.status).toBe("RESTORED");
    expect(result.updatedComment?.status).toBe("VISIBLE");
    expect(repository.completedRunSummary).toBe("所有 Agent 风险建议均已处理。");
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMMENT_STATUS_UPDATED",
        resourceId: "comment-1",
      }),
    );
    expect(recordAudit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_AGENT_FINDING_DECIDED",
        resourceId: "comment-1",
      }),
    );
  });

  it("rejects decisions for non-pending findings", async () => {
    const useCase = new DecideAdminAgentFindingUseCase(
      new MemoryAdminAgentRepository(createFinding({ status: "EXECUTED" })),
      createRecordAuditDouble(),
      createUpdateCommentDouble(),
    );

    await expect(
      useCase.execute({
        actor: createActor(),
        decision: "REJECT",
        findingId: "finding-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentFindingDecisionError);
  });

  it("rejects unsupported proposed actions before updating the comment", async () => {
    const updateComment = createUpdateCommentDouble();
    const useCase = new DecideAdminAgentFindingUseCase(
      new MemoryAdminAgentRepository(
        createFinding({
          proposedAction: "NO_ACTION",
        }),
      ),
      createRecordAuditDouble(),
      updateComment,
    );

    await expect(
      useCase.execute({
        actor: createActor(),
        decision: "EXECUTE_PROPOSED_ACTION",
        findingId: "finding-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentFindingDecisionError);
    expect(updateComment.execute).not.toHaveBeenCalled();
  });

  it("rejects restore decisions for findings that were not executed", async () => {
    const useCase = new DecideAdminAgentFindingUseCase(
      new MemoryAdminAgentRepository(createFinding({ status: "REJECTED" })),
      createRecordAuditDouble(),
      createUpdateCommentDouble(),
    );

    await expect(
      useCase.execute({
        actor: createActor(),
        decision: "RESTORE_COMMENT",
        findingId: "finding-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentFindingDecisionError);
  });

  it("keeps the run waiting while sibling findings are still pending", async () => {
    const repository = new MemoryAdminAgentRepository(createFinding({ status: "PENDING" }), [
      createFinding({
        id: "finding-2",
        status: "PENDING",
        targetId: "comment-2",
      }),
    ]);
    const useCase = new DecideAdminAgentFindingUseCase(
      repository,
      createRecordAuditDouble(),
      createUpdateCommentDouble(),
    );

    await useCase.execute({
      actor: createActor(),
      decision: "REJECT",
      findingId: "finding-1",
    });

    expect(repository.completedRunSummary).toBeNull();
  });
});

class MemoryAdminAgentRepository implements AdminAgentRepository {
  completedRunSummary: string | null = null;
  decisionEffects: AdminAgentDecisionEffect[] = [];
  statusHistory: AdminAgentFinding["status"][] = [];

  constructor(
    private finding: AdminAgentFinding | null,
    private readonly siblingFindings: AdminAgentFinding[] = [],
  ) {}

  async findFindingById() {
    return this.finding;
  }

  async findRunById(): Promise<AdminAgentRun | null> {
    throw new Error("not used");
  }

  async findRunByThreadId(): Promise<AdminAgentRun | null> {
    throw new Error("not used");
  }

  async listRuns() {
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  async markFindingExecuted() {
    return this.setFindingStatus("EXECUTED");
  }

  async markFindingFailed() {
    return this.setFindingStatus("FAILED");
  }

  async markFindingRejected() {
    return this.setFindingStatus("REJECTED");
  }

  async markFindingRestored() {
    return this.setFindingStatus("RESTORED");
  }

  private setFindingStatus(status: AdminAgentFinding["status"]) {
    if (!this.finding) {
      throw new Error("missing finding");
    }

    this.statusHistory.push(status);
    this.finding = {
      ...this.finding,
      executedAt: status === "EXECUTED" ? new Date("2026-07-04T12:00:00.000Z") : null,
      status,
      updatedAt: new Date("2026-07-04T12:00:00.000Z"),
    };

    return this.finding;
  }

  async createRun(_input: CreateAdminAgentRunInput): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async createWorkflowEvent(): Promise<
    Awaited<ReturnType<AdminAgentRepository["createWorkflowEvent"]>>
  > {
    throw new Error("not used");
  }

  async ensureWorkflowActionExecution(): Promise<
    Awaited<ReturnType<AdminAgentRepository["ensureWorkflowActionExecution"]>>
  > {
    throw new Error("not used");
  }

  async markWorkflowActionExecutionSucceeded(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markWorkflowActionExecutionSucceeded"]>>
  > {
    throw new Error("not used");
  }

  async markWorkflowActionExecutionFailed(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markWorkflowActionExecutionFailed"]>>
  > {
    throw new Error("not used");
  }

  async markRunRunning(): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async markRunNode(): Promise<void> {
    throw new Error("not used");
  }

  async listWorkflowEventsByRunId() {
    return [];
  }

  async listLatestWorkflowEventsByRunIds() {
    return [];
  }

  async markRunInterrupted(): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async markRunWaitingForApproval(): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async completeRun(_id: string, summary: string): Promise<AdminAgentRun> {
    this.completedRunSummary = summary;
    return createRun({
      status: "COMPLETED",
      summary,
    });
  }

  async cancelRun(): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async failRun(): Promise<AdminAgentRun> {
    throw new Error("not used");
  }

  async ensureDecisionEffect(
    input: EnsureAdminAgentDecisionEffectInput,
  ): Promise<AdminAgentDecisionEffect> {
    const existingEffect = this.decisionEffects.find(
      (effect) => effect.effectKey === input.effectKey,
    );

    if (existingEffect) {
      return existingEffect;
    }

    const effect: AdminAgentDecisionEffect = {
      attempts: 0,
      createdAt: new Date("2026-07-04T12:00:00.000Z"),
      effectKey: input.effectKey,
      errorMessage: null,
      findingId: input.findingId ?? null,
      id: `effect-${this.decisionEffects.length + 1}`,
      payload: input.payload,
      runId: input.runId,
      status: "PENDING",
      type: input.type,
      updatedAt: new Date("2026-07-04T12:00:00.000Z"),
    };

    this.decisionEffects.push(effect);

    return effect;
  }

  async listRepairableDecisionEffects(): Promise<AdminAgentDecisionEffect[]> {
    return this.decisionEffects.filter(
      (effect) => effect.status === "PENDING" || effect.status === "FAILED",
    );
  }

  async markDecisionEffectSucceeded(id: string): Promise<AdminAgentDecisionEffect> {
    return this.updateDecisionEffect(id, {
      errorMessage: null,
      status: "SUCCEEDED",
    });
  }

  async markDecisionEffectFailed(
    id: string,
    errorMessage: string,
  ): Promise<AdminAgentDecisionEffect> {
    const effect = this.decisionEffects.find((item) => item.id === id);

    if (!effect) {
      throw new Error("missing decision effect");
    }

    return this.updateDecisionEffect(id, {
      attempts: effect.attempts + 1,
      errorMessage,
      status: "FAILED",
    });
  }

  private updateDecisionEffect(
    id: string,
    patch: Partial<Pick<AdminAgentDecisionEffect, "attempts" | "errorMessage" | "status">>,
  ): AdminAgentDecisionEffect {
    const effectIndex = this.decisionEffects.findIndex((effect) => effect.id === id);

    if (effectIndex === -1) {
      throw new Error("missing decision effect");
    }

    const effect = {
      ...this.decisionEffects[effectIndex],
      ...patch,
      updatedAt: new Date("2026-07-04T12:01:00.000Z"),
    };
    this.decisionEffects[effectIndex] = effect;

    return effect;
  }

  async listTodayVisibleCommentsForAnalysis(
    _input: ListTodayVisibleCommentsForAnalysisInput,
  ): Promise<AdminAgentCommentForAnalysis[]> {
    throw new Error("not used");
  }

  async listRecentVisibleCommentsForAnalysis(
    _input: ListRecentVisibleCommentsForAnalysisInput,
  ): Promise<AdminAgentCommentForAnalysis[]> {
    throw new Error("not used");
  }

  async createFindings(
    _runId: string,
    _findings: AdminAgentFindingDraft[],
  ): Promise<AdminAgentFinding[]> {
    throw new Error("not used");
  }

  async listPendingFindingsByTargetIds(_targetIds: string[]): Promise<AdminAgentFinding[]> {
    throw new Error("not used");
  }

  async listFindingsByIds(_ids: string[]): Promise<AdminAgentFinding[]> {
    throw new Error("not used");
  }

  async listFindingsByRunId(): Promise<AdminAgentFinding[]> {
    return [this.finding, ...this.siblingFindings].filter(
      (finding): finding is AdminAgentFinding => finding !== null,
    );
  }
}

function createRecordAuditDouble() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordAdminOperationUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createUpdateCommentDouble(comment = createComment()) {
  return {
    execute: vi.fn().mockResolvedValue(comment),
  } as unknown as UpdateAdminArticleCommentStatusUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createActor(): AdminOperationActor {
  return {
    id: "admin-1",
    login: "adrian",
  };
}

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

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 0,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    interruption: null,
    input: {},
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "admin-1",
    status: "WAITING_FOR_APPROVAL",
    summary: null,
    threadId: null,
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}

function createComment(
  overrides: Partial<AdminArticleCommentListItem> = {},
): AdminArticleCommentListItem {
  return {
    article: {
      id: "article-1",
      slug: "article",
      title: "Article",
    },
    author: {
      avatarUrl: null,
      id: "user-1",
      login: "reader",
      name: "Reader",
      profileUrl: "https://github.com/reader",
    },
    body: "spam",
    createdAt: new Date("2026-07-04T09:00:00.000Z"),
    id: "comment-1",
    likeCount: 0,
    parent: null,
    parentCommentId: null,
    replyCount: 0,
    status: "HIDDEN",
    updatedAt: new Date("2026-07-04T12:00:00.000Z"),
    ...overrides,
  };
}
