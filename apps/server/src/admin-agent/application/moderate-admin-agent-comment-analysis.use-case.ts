import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import {
  ADMIN_AGENT_REPOSITORY,
  type AdminAgentRepository,
} from "../domain/admin-agent.repository";
import { DecideAdminAgentFindingsUseCase } from "./decide-admin-agent-findings.use-case";

type ModerateAdminAgentCommentAnalysisInput = {
  action: "HIDE" | "RESTORE";
  actor: AdminOperationActor;
  analysisId: string;
  findingIds: string[];
  requestContext?: AdminOperationRequestContext;
};

@Injectable()
class ModerateAdminAgentCommentAnalysisUseCase {
  constructor(
    private readonly decideAdminAgentFindings: DecideAdminAgentFindingsUseCase,
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
  ) {}

  async execute(input: ModerateAdminAgentCommentAnalysisInput) {
    const analysis = await this.adminAgentRepository.findRunById(input.analysisId);

    if (!analysis || analysis.workflowName !== "COMMENT_MODERATION_ANALYSIS") {
      throw new AdminAgentCommentAnalysisNotFoundError(input.analysisId);
    }

    const findingIds = normalizeFindingIds(input.findingIds);

    if (findingIds.length === 0) {
      throw new AdminAgentCommentAnalysisSelectionError(
        "Select at least one finding from this comment analysis.",
      );
    }

    const requestedFindings = await this.adminAgentRepository.listFindingsByIds(findingIds);

    if (
      requestedFindings.length !== findingIds.length ||
      requestedFindings.some((finding) => finding.runId !== analysis.id)
    ) {
      throw new AdminAgentCommentAnalysisSelectionError(
        "Every selected finding must belong to the requested comment analysis.",
      );
    }

    const result = await this.decideAdminAgentFindings.execute({
      actor: input.actor,
      decisions: findingIds.map((findingId) => ({
        decision: input.action === "RESTORE" ? "RESTORE_COMMENT" : "EXECUTE_PROPOSED_ACTION",
        findingId,
      })),
      requestContext: input.requestContext,
    });
    const findings = await this.adminAgentRepository.listFindingsByRunId(analysis.id);

    return {
      analysis,
      findings,
      result,
    };
  }
}

class AdminAgentCommentAnalysisNotFoundError extends Error {
  constructor(analysisId: string) {
    super(`Comment analysis ${analysisId} was not found.`);
  }
}

class AdminAgentCommentAnalysisSelectionError extends Error {}

function normalizeFindingIds(value: string[]) {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
}

export {
  AdminAgentCommentAnalysisNotFoundError,
  AdminAgentCommentAnalysisSelectionError,
  ModerateAdminAgentCommentAnalysisUseCase,
};
export type { ModerateAdminAgentCommentAnalysisInput };
