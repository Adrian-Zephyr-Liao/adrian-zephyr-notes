import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import {
  ADMIN_AGENT_REPOSITORY,
  type AdminAgentRepository,
} from "../domain/admin-agent.repository";
import type { AdminAgentDecisionEffect } from "../domain/admin-agent-decision-effect.entity";
import type { AdminAgentFindingDecision } from "../domain/admin-agent-action-policy";

type RepairAdminAgentDecisionEffectsInput = {
  limit?: number;
  runId?: string;
};

type RepairAdminAgentDecisionEffectsResult = {
  failedCount: number;
  repairedCount: number;
  skippedCount: number;
};

const DEFAULT_REPAIR_LIMIT = 50;

@Injectable()
class RepairAdminAgentDecisionEffectsUseCase {
  constructor(
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
  ) {}

  async execute(
    input: RepairAdminAgentDecisionEffectsInput = {},
  ): Promise<RepairAdminAgentDecisionEffectsResult> {
    const effects = await this.adminAgentRepository.listRepairableDecisionEffects({
      limit: input.limit ?? DEFAULT_REPAIR_LIMIT,
      runId: input.runId,
    });
    const result: RepairAdminAgentDecisionEffectsResult = {
      failedCount: 0,
      repairedCount: 0,
      skippedCount: 0,
    };

    for (const effect of effects) {
      try {
        const repaired = await this.repairEffect(effect);

        if (repaired) {
          await this.adminAgentRepository.markDecisionEffectSucceeded(effect.id);
          result.repairedCount += 1;
        } else {
          result.skippedCount += 1;
        }
      } catch (error) {
        await this.adminAgentRepository.markDecisionEffectFailed(
          effect.id,
          toRepairFailureMessage(error),
        );
        result.failedCount += 1;
      }
    }

    return result;
  }

  private async repairEffect(effect: AdminAgentDecisionEffect) {
    if (effect.type === "FINDING_DECISION_AUDIT") {
      await this.recordFindingDecisionAudit(effect);
      return true;
    }

    if (effect.type === "COMMENT_STATUS_AUDIT") {
      await this.recordCommentStatusAudit(effect);
      return true;
    }

    return this.completeRunWhenNoPendingFindings(effect.runId);
  }

  private async recordFindingDecisionAudit(effect: AdminAgentDecisionEffect) {
    const payload = effect.payload;
    const actor = toActor(payload.actor);
    const decision = toFindingDecision(payload.decision);
    const requestContext = toRequestContext(payload.requestContext);
    const targetId = toRequiredString(payload.targetId, "targetId");
    const findingId = toRequiredString(payload.findingId, "findingId");

    await this.recordAdminOperation.execute({
      action: "ADMIN_AGENT_FINDING_DECIDED",
      actor,
      metadata: {
        agentFindingId: findingId,
        agentRunId: effect.runId,
        decision,
        effectKey: effect.effectKey,
        source: "admin_agent",
        targetId,
      },
      requestContext,
      resourceId: targetId,
      resourceType: "article_comment",
    });
  }

  private async recordCommentStatusAudit(effect: AdminAgentDecisionEffect) {
    const payload = effect.payload;
    const actor = toActor(payload.actor);
    const articleSlug = toRequiredString(payload.articleSlug, "articleSlug");
    const findingId = toRequiredString(payload.findingId, "findingId");
    const requestContext = toRequestContext(payload.requestContext);
    const status = toRequiredString(payload.status, "status");
    const targetId = toRequiredString(payload.targetId, "targetId");

    await this.recordAdminOperation.execute({
      action: "COMMENT_STATUS_UPDATED",
      actor,
      metadata: {
        agentFindingId: findingId,
        agentRunId: effect.runId,
        articleSlug,
        effectKey: effect.effectKey,
        source: "admin_agent",
        status,
      },
      requestContext,
      resourceId: targetId,
      resourceType: "article_comment",
    });
  }

  private async completeRunWhenNoPendingFindings(runId: string) {
    const run = await this.adminAgentRepository.findRunById(runId);

    if (run?.status === "COMPLETED") {
      return true;
    }

    const findings = await this.adminAgentRepository.listFindingsByRunId(runId);

    if (findings.some((finding) => finding.status === "PENDING")) {
      return false;
    }

    await this.adminAgentRepository.completeRun(runId, "所有 Agent 风险建议均已处理。");

    return true;
  }
}

function toActor(value: unknown): AdminOperationActor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Decision effect payload is missing actor.");
  }

  const record = value as Record<string, unknown>;
  const login = toRequiredString(record.login, "actor.login");
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;

  return {
    id,
    login,
  };
}

function toFindingDecision(value: unknown): AdminAgentFindingDecision {
  if (value === "EXECUTE_PROPOSED_ACTION" || value === "REJECT" || value === "RESTORE_COMMENT") {
    return value;
  }

  throw new Error("Decision effect payload has an invalid finding decision.");
}

function toRequestContext(value: unknown): AdminOperationRequestContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    ipAddress: typeof record.ipAddress === "string" ? record.ipAddress : undefined,
    userAgent: typeof record.userAgent === "string" ? record.userAgent : undefined,
  };
}

function toRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Decision effect payload is missing ${field}.`);
  }

  return value.trim();
}

function toRepairFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown decision effect repair failure.";
}

export { RepairAdminAgentDecisionEffectsUseCase };
export type { RepairAdminAgentDecisionEffectsInput, RepairAdminAgentDecisionEffectsResult };
