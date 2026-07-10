import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import { AdminAgentWorkflowActionExecutionInProgressError } from "../domain/admin-agent-workflow-action-execution.entity";
import type { CommentModerationApprovalResume } from "../domain/admin-agent-workflow-approval";
import { toExecutableCommentModerationFindingIds } from "../domain/admin-agent-comment-moderation-action";
import { toAdminAgentWorkflowFailureMessage } from "../domain/admin-agent-workflow-output";

type ExecuteCommentModerationApprovalActionInput = {
  actionExecutor: AdminAgentWorkflowActionExecutor;
  approval: CommentModerationApprovalResume;
  repository: Pick<
    AdminAgentRepository,
    | "ensureWorkflowActionExecution"
    | "listFindingsByIds"
    | "markWorkflowActionExecutionFailed"
    | "markWorkflowActionExecutionSucceeded"
  >;
  runId: string;
};

async function executeCommentModerationApprovalAction(
  input: ExecuteCommentModerationApprovalActionInput,
): Promise<AdminAgentWorkflowActionExecutionResult> {
  if (!input.approval.actor) {
    throw new Error("Admin agent workflow approval is missing actor context.");
  }

  const approvalId = `comment-moderation:${input.runId}`;
  const executionClaim = await input.repository.ensureWorkflowActionExecution({
    action: "HIDE_COMMENT",
    approvalId,
    payload: {
      findingIds: [...new Set(input.approval.findingIds)],
    },
    runId: input.runId,
    subject: "ARTICLE_COMMENT",
  });
  const { execution } = executionClaim;

  if (executionClaim.claimStatus === "SUCCEEDED") {
    if (!execution.result) {
      throw new Error("Comment moderation approval action execution result is missing.");
    }

    return execution.result;
  }

  if (executionClaim.claimStatus === "IN_PROGRESS") {
    throw new AdminAgentWorkflowActionExecutionInProgressError(approvalId);
  }

  try {
    const currentFindings = await input.repository.listFindingsByIds(input.approval.findingIds);
    const findingIds = toExecutableCommentModerationFindingIds(
      input.approval.findingIds,
      currentFindings,
    );
    const result =
      findingIds.length > 0
        ? await input.actionExecutor.executeAction({
            action: "HIDE_COMMENT",
            actor: input.approval.actor,
            payload: {
              findingIds,
            },
            requestContext: input.approval.requestContext,
            subject: "ARTICLE_COMMENT",
          })
        : toRecoveredCommentModerationResult(input.approval.findingIds, currentFindings);

    await input.repository.markWorkflowActionExecutionSucceeded(execution.id, result);

    return result;
  } catch (error) {
    await input.repository.markWorkflowActionExecutionFailed(
      execution.id,
      toAdminAgentWorkflowFailureMessage(error),
    );
    throw error;
  }
}

function toRecoveredCommentModerationResult(
  requestedFindingIds: string[],
  findings: AdminAgentFinding[],
): AdminAgentWorkflowActionExecutionResult {
  const findingById = new Map(findings.map((finding) => [finding.id, finding]));
  const results = [...new Set(requestedFindingIds)].flatMap((findingId) => {
    const finding = findingById.get(findingId);

    if (finding?.status !== "EXECUTED" || finding.proposedAction !== "HIDE_COMMENT") {
      return [];
    }

    return [
      {
        resourceId: finding.target?.id ?? finding.targetId,
        status: "APPLIED" as const,
        summary: finding.target?.status === "HIDDEN" ? "评论已屏蔽。" : "评论治理建议已执行。",
      },
    ];
  });

  return {
    appliedCount: results.length,
    failedCount: 0,
    results,
  };
}

export { executeCommentModerationApprovalAction };
export type { ExecuteCommentModerationApprovalActionInput };
