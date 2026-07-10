import { Injectable } from "@nestjs/common";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";
import type { DecideAdminAgentFindingDecision } from "./decide-admin-agent-finding.use-case";
import { DecideAdminAgentFindingUseCase } from "./decide-admin-agent-finding.use-case";

type DecideAdminAgentFindingsInput = {
  actor: AdminOperationActor;
  decisions: DecideAdminAgentFindingItemInput[];
  requestContext?: AdminOperationRequestContext;
};

type DecideAdminAgentFindingItemInput = {
  decision: DecideAdminAgentFindingDecision;
  findingId: string;
};

type DecideAdminAgentFindingItemResult =
  | {
      decision: DecideAdminAgentFindingDecision;
      findingId: string;
      result: Awaited<ReturnType<DecideAdminAgentFindingUseCase["execute"]>>;
      status: "APPLIED";
    }
  | {
      decision: DecideAdminAgentFindingDecision;
      error: {
        code: string;
        message: string;
      };
      findingId: string;
      status: "FAILED";
    };

type DecideAdminAgentFindingsResult = {
  results: DecideAdminAgentFindingItemResult[];
};

@Injectable()
class DecideAdminAgentFindingsUseCase {
  constructor(private readonly decideAdminAgentFinding: DecideAdminAgentFindingUseCase) {}

  async execute(input: DecideAdminAgentFindingsInput): Promise<DecideAdminAgentFindingsResult> {
    const results: DecideAdminAgentFindingItemResult[] = [];

    for (const decision of input.decisions) {
      try {
        results.push({
          decision: decision.decision,
          findingId: decision.findingId,
          result: await this.decideAdminAgentFinding.execute({
            actor: input.actor,
            decision: decision.decision,
            findingId: decision.findingId,
            requestContext: input.requestContext,
          }),
          status: "APPLIED",
        });
      } catch (error) {
        results.push({
          decision: decision.decision,
          error: toBatchDecisionError(error),
          findingId: decision.findingId,
          status: "FAILED",
        });
      }
    }

    return { results };
  }
}

function toBatchDecisionError(error: unknown) {
  if (error instanceof Error) {
    return {
      code: error.constructor.name || "ADMIN_AGENT_FINDING_DECISION_FAILED",
      message: error.message,
    };
  }

  return {
    code: "ADMIN_AGENT_FINDING_DECISION_FAILED",
    message: "Agent finding decision failed.",
  };
}

export { DecideAdminAgentFindingsUseCase };
export type {
  DecideAdminAgentFindingItemInput,
  DecideAdminAgentFindingItemResult,
  DecideAdminAgentFindingsInput,
  DecideAdminAgentFindingsResult,
};
