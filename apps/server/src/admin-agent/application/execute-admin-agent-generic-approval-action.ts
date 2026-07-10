import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import { AdminAgentWorkflowActionExecutionInProgressError } from "../domain/admin-agent-workflow-action-execution.entity";
import type { GenericApprovalResume } from "../domain/admin-agent-workflow-approval";
import { isGenericApprovalApproved } from "../domain/admin-agent-workflow-approval";
import {
  isReadOnlyGenericApprovalAction,
  toAdminAgentWorkflowFailureMessage,
} from "../domain/admin-agent-workflow-output";

type ExecuteAdminAgentGenericApprovalActionInput = {
  actionExecutor: AdminAgentWorkflowActionExecutor;
  approval: GenericApprovalResume | null;
  repository: Pick<
    AdminAgentRepository,
    | "ensureWorkflowActionExecution"
    | "markWorkflowActionExecutionFailed"
    | "markWorkflowActionExecutionSucceeded"
  >;
  runId: string;
};

async function executeAdminAgentGenericApprovalAction(
  input: ExecuteAdminAgentGenericApprovalActionInput,
): Promise<AdminAgentWorkflowActionExecutionResult | null> {
  const { approval } = input;

  if (
    !approval ||
    !isGenericApprovalApproved(approval) ||
    isReadOnlyGenericApprovalAction(approval.action)
  ) {
    return null;
  }

  if (!approval.actor || !approval.action || !approval.approvalId || !approval.subject) {
    throw new Error("Admin agent approved action is missing execution context.");
  }

  const executionClaim = await input.repository.ensureWorkflowActionExecution({
    action: approval.action,
    approvalId: approval.approvalId,
    payload: approval.payload ?? {},
    runId: input.runId,
    subject: approval.subject,
  });
  const { execution } = executionClaim;

  if (executionClaim.claimStatus === "SUCCEEDED") {
    if (!execution.result) {
      throw new Error("Admin agent approved action execution result is missing.");
    }

    return execution.result;
  }

  if (executionClaim.claimStatus === "IN_PROGRESS") {
    throw new AdminAgentWorkflowActionExecutionInProgressError(approval.approvalId);
  }

  try {
    const result = await input.actionExecutor.executeAction({
      action: approval.action,
      actor: approval.actor,
      payload: approval.payload ?? {},
      requestContext: approval.requestContext,
      subject: approval.subject,
    });

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

export { executeAdminAgentGenericApprovalAction };
export type { ExecuteAdminAgentGenericApprovalActionInput };
