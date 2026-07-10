import { Injectable } from "@nestjs/common";
import {
  AdminAgentWorkflowActionValidationError,
  type AdminAgentWorkflowActionExecutionResult,
  type AdminAgentWorkflowActionHandler,
  type ExecuteAdminAgentWorkflowActionInput,
} from "../domain/admin-agent-workflow-action-executor";
import { DecideAdminAgentFindingsUseCase } from "./decide-admin-agent-findings.use-case";

@Injectable()
class CommentModerationAgentActionHandler implements AdminAgentWorkflowActionHandler {
  readonly actionKey = "ARTICLE_COMMENT.HIDE_COMMENT" as const;

  constructor(private readonly decideAdminAgentFindings: DecideAdminAgentFindingsUseCase) {}

  async execute(
    input: ExecuteAdminAgentWorkflowActionInput,
  ): Promise<AdminAgentWorkflowActionExecutionResult> {
    const findingIds = toStringList(input.payload.findingIds);

    if (findingIds.length === 0) {
      throw new AdminAgentWorkflowActionValidationError(
        "Comment moderation approval requires findingIds.",
      );
    }

    const result = await this.decideAdminAgentFindings.execute({
      actor: input.actor,
      decisions: findingIds.map((findingId) => ({
        decision: "EXECUTE_PROPOSED_ACTION",
        findingId,
      })),
      requestContext: input.requestContext,
    });
    const appliedCount = result.results.filter((item) => item.status === "APPLIED").length;

    return {
      appliedCount,
      failedCount: result.results.length - appliedCount,
      results: result.results.map((item) => {
        if (item.status === "FAILED") {
          return {
            error: item.error,
            resourceId: item.findingId,
            status: "FAILED",
          };
        }

        const updatedComment = item.result.updatedComment;

        return {
          resourceId: updatedComment?.id ?? item.result.finding.targetId,
          status: "APPLIED",
          summary: updatedComment?.status === "HIDDEN" ? "评论已屏蔽。" : "评论治理建议已执行。",
        };
      }),
    };
  }
}

function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export { CommentModerationAgentActionHandler };
