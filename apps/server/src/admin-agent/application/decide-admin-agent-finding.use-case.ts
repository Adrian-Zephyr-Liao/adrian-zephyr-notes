import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import type { AdminArticleCommentListItem } from "../../comments/domain/admin-article-comment.repository";
import { UpdateAdminArticleCommentStatusUseCase } from "../../comments/application/update-admin-article-comment-status.use-case";
import {
  ADMIN_AGENT_REPOSITORY,
  type AdminAgentRepository,
} from "../domain/admin-agent.repository";
import {
  evaluateAdminAgentFindingActionPolicy,
  type AdminAgentFindingDecision,
} from "../domain/admin-agent-action-policy";
import type { AdminAgentDecisionEffectType } from "../domain/admin-agent-decision-effect.entity";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import {
  AdminAgentFindingDecisionError,
  AdminAgentFindingNotFoundError,
} from "./admin-agent-finding.errors";

type DecideAdminAgentFindingInput = {
  actor: AdminOperationActor;
  decision: AdminAgentFindingDecision;
  findingId: string;
  requestContext?: AdminOperationRequestContext;
};

type DecideAdminAgentFindingResult = {
  finding: AdminAgentFinding;
  updatedComment: AdminArticleCommentListItem | null;
};

type AdminAgentDecisionEffectDescriptor = {
  effectKey: string;
  execute: () => Promise<unknown>;
  findingId: string;
  payload: Record<string, unknown>;
  runId: string;
  type: AdminAgentDecisionEffectType;
};

@Injectable()
class DecideAdminAgentFindingUseCase {
  private readonly logger = new Logger(DecideAdminAgentFindingUseCase.name);

  constructor(
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateAdminArticleCommentStatus: UpdateAdminArticleCommentStatusUseCase,
  ) {}

  async execute(input: DecideAdminAgentFindingInput): Promise<DecideAdminAgentFindingResult> {
    const finding = await this.adminAgentRepository.findFindingById(input.findingId);

    if (!finding) {
      throw new AdminAgentFindingNotFoundError();
    }

    const policy = evaluateAdminAgentFindingActionPolicy(finding, input.decision);

    if (!policy.allowed) {
      throw new AdminAgentFindingDecisionError(policy.reason);
    }

    if (policy.action === "REJECT_FINDING") {
      const rejectedFinding = await this.adminAgentRepository.markFindingRejected(finding.id);
      await this.recordPostDecisionEffects(input, rejectedFinding);

      return {
        finding: rejectedFinding,
        updatedComment: null,
      };
    }

    if (policy.action === "RESTORE_COMMENT") {
      return this.restoreExecutedComment(input, finding);
    }

    return this.executeProposedAction(input, finding);
  }

  private async executeProposedAction(
    input: DecideAdminAgentFindingInput,
    finding: AdminAgentFinding,
  ): Promise<DecideAdminAgentFindingResult> {
    let executedFinding: AdminAgentFinding;
    let updatedComment: AdminArticleCommentListItem;

    try {
      updatedComment = await this.updateAdminArticleCommentStatus.execute({
        id: finding.targetId,
        status: "HIDDEN",
      });
      executedFinding = await this.adminAgentRepository.markFindingExecuted(finding.id);
    } catch (error) {
      await this.adminAgentRepository.markFindingFailed(finding.id);
      throw error;
    }

    await this.recordPostDecisionEffects(input, executedFinding, updatedComment);

    return {
      finding: executedFinding,
      updatedComment,
    };
  }

  private async restoreExecutedComment(
    input: DecideAdminAgentFindingInput,
    finding: AdminAgentFinding,
  ): Promise<DecideAdminAgentFindingResult> {
    const updatedComment = await this.updateAdminArticleCommentStatus.execute({
      id: finding.targetId,
      status: "VISIBLE",
    });
    const restoredFinding = await this.adminAgentRepository.markFindingRestored(finding.id);

    await this.recordPostDecisionEffects(input, restoredFinding, updatedComment);

    return {
      finding: restoredFinding,
      updatedComment,
    };
  }

  private async recordPostDecisionEffects(
    input: DecideAdminAgentFindingInput,
    finding: AdminAgentFinding,
    updatedComment: AdminArticleCommentListItem | null = null,
  ) {
    const effects: AdminAgentDecisionEffectDescriptor[] = [
      {
        effectKey: createDecisionEffectKey("FINDING_DECISION_AUDIT", finding),
        execute: () => this.recordDecisionAudit(input, finding),
        findingId: finding.id,
        payload: {
          actor: input.actor,
          decision: input.decision,
          findingId: finding.id,
          requestContext: input.requestContext ?? null,
          targetId: finding.targetId,
        },
        runId: finding.runId,
        type: "FINDING_DECISION_AUDIT",
      },
    ];

    if (updatedComment) {
      effects.push({
        effectKey: createDecisionEffectKey("COMMENT_STATUS_AUDIT", finding),
        execute: () => this.recordCommentStatusAudit(input, finding, updatedComment),
        findingId: finding.id,
        payload: {
          actor: input.actor,
          articleSlug: updatedComment.article.slug,
          findingId: finding.id,
          requestContext: input.requestContext ?? null,
          status: updatedComment.status,
          targetId: updatedComment.id,
        },
        runId: finding.runId,
        type: "COMMENT_STATUS_AUDIT",
      });
    }

    effects.push({
      effectKey: createDecisionEffectKey("RUN_COMPLETION", finding),
      execute: () => this.completeRunWhenNoPendingFindings(finding.runId),
      findingId: finding.id,
      payload: {
        findingId: finding.id,
        findingStatus: finding.status,
        runId: finding.runId,
      },
      runId: finding.runId,
      type: "RUN_COMPLETION",
    });

    for (const effect of effects) {
      await this.runPostDecisionEffect(effect);
    }
  }

  private async runPostDecisionEffect(descriptor: AdminAgentDecisionEffectDescriptor) {
    const effect = await this.ensurePostDecisionEffect(descriptor);

    if (!effect || effect.status === "SUCCEEDED") {
      return;
    }

    try {
      await descriptor.execute();
      await this.adminAgentRepository.markDecisionEffectSucceeded(effect.id);
    } catch (error) {
      const errorMessage = toPostDecisionEffectErrorMessage(error);

      try {
        await this.adminAgentRepository.markDecisionEffectFailed(effect.id, errorMessage);
      } catch (markFailedError) {
        this.logger.warn(
          `Failed to persist Agent decision effect failure ${descriptor.effectKey}.`,
          markFailedError instanceof Error ? markFailedError.stack : undefined,
        );
      }

      this.logger.warn(
        `Failed to run Agent decision effect ${descriptor.effectKey}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async ensurePostDecisionEffect(descriptor: AdminAgentDecisionEffectDescriptor) {
    try {
      return await this.adminAgentRepository.ensureDecisionEffect({
        effectKey: descriptor.effectKey,
        findingId: descriptor.findingId,
        payload: descriptor.payload,
        runId: descriptor.runId,
        type: descriptor.type,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist Agent decision effect ${descriptor.effectKey}.`,
        error instanceof Error ? error.stack : undefined,
      );

      return null;
    }
  }

  private async recordDecisionAudit(
    input: DecideAdminAgentFindingInput,
    finding: AdminAgentFinding,
  ) {
    await this.recordAdminOperation.execute({
      action: "ADMIN_AGENT_FINDING_DECIDED",
      actor: input.actor,
      metadata: {
        agentFindingId: finding.id,
        agentRunId: finding.runId,
        decision: input.decision,
        effectKey: createDecisionEffectKey("FINDING_DECISION_AUDIT", finding),
        source: "admin_agent",
        targetId: finding.targetId,
      },
      requestContext: input.requestContext,
      resourceId: finding.targetId,
      resourceType: "article_comment",
    });
  }

  private async recordCommentStatusAudit(
    input: DecideAdminAgentFindingInput,
    finding: AdminAgentFinding,
    updatedComment: AdminArticleCommentListItem,
  ) {
    await this.recordAdminOperation.execute({
      action: "COMMENT_STATUS_UPDATED",
      actor: input.actor,
      metadata: {
        agentFindingId: finding.id,
        agentRunId: finding.runId,
        articleSlug: updatedComment.article.slug,
        effectKey: createDecisionEffectKey("COMMENT_STATUS_AUDIT", finding),
        source: "admin_agent",
        status: updatedComment.status,
      },
      requestContext: input.requestContext,
      resourceId: updatedComment.id,
      resourceType: "article_comment",
    });
  }

  private async completeRunWhenNoPendingFindings(runId: string) {
    const findings = await this.adminAgentRepository.listFindingsByRunId(runId);

    if (findings.some((finding) => finding.status === "PENDING")) {
      return;
    }

    await this.adminAgentRepository.completeRun(runId, "所有 Agent 风险建议均已处理。");
  }
}

function createDecisionEffectKey(type: AdminAgentDecisionEffectType, finding: AdminAgentFinding) {
  return [
    "admin-agent-decision-effect",
    type,
    finding.runId,
    finding.id,
    finding.status,
    finding.updatedAt.toISOString(),
  ].join(":");
}

function toPostDecisionEffectErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Agent decision effect failure.";
}

export { DecideAdminAgentFindingUseCase };
export type {
  AdminAgentFindingDecision as DecideAdminAgentFindingDecision,
  DecideAdminAgentFindingInput,
  DecideAdminAgentFindingResult,
};
