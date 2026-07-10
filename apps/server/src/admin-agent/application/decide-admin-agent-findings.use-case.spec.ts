import { describe, expect, it, vi } from "vitest";
import { AdminAgentFindingDecisionError } from "./admin-agent-finding.errors";
import type { DecideAdminAgentFindingUseCase } from "./decide-admin-agent-finding.use-case";
import { DecideAdminAgentFindingsUseCase } from "./decide-admin-agent-findings.use-case";

describe("DecideAdminAgentFindingsUseCase", () => {
  it("returns per-item results for partial success batches", async () => {
    const decideOne = {
      execute: vi.fn(async (input: { findingId: string }) => {
        if (input.findingId === "finding-failed") {
          throw new AdminAgentFindingDecisionError("Only pending findings can be rejected.");
        }

        return {
          finding: {
            id: input.findingId,
            status: "EXECUTED",
          },
          updatedComment: null,
        };
      }),
    } as unknown as DecideAdminAgentFindingUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };
    const useCase = new DecideAdminAgentFindingsUseCase(decideOne);

    const result = await useCase.execute({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      decisions: [
        {
          decision: "EXECUTE_PROPOSED_ACTION",
          findingId: "finding-applied",
        },
        {
          decision: "REJECT",
          findingId: "finding-failed",
        },
      ],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        decision: "EXECUTE_PROPOSED_ACTION",
        findingId: "finding-applied",
        status: "APPLIED",
      }),
      {
        decision: "REJECT",
        error: {
          code: "AdminAgentFindingDecisionError",
          message: "Only pending findings can be rejected.",
        },
        findingId: "finding-failed",
        status: "FAILED",
      },
    ]);
    expect(decideOne.execute).toHaveBeenCalledTimes(2);
  });
});
