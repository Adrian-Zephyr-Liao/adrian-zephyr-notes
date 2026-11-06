import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS,
  ADMIN_AGENT_ATOMIC_ACTION_EXECUTOR,
  AdminAgentWorkflowActionUnsupportedError,
  type AdminAgentWorkflowActionExecutionResult,
  type AdminAgentWorkflowActionExecutor,
  type AdminAgentWorkflowActionHandler,
  type ExecuteAdminAgentWorkflowActionInput,
  type AdminAgentAtomicActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";

@Injectable()
class ExecuteAdminAgentWorkflowActionUseCase implements AdminAgentWorkflowActionExecutor {
  constructor(
    @Inject(ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS)
    private readonly handlers: AdminAgentWorkflowActionHandler[],
    @Optional()
    @Inject(ADMIN_AGENT_ATOMIC_ACTION_EXECUTOR)
    private readonly atomicExecutor?: AdminAgentAtomicActionExecutor,
  ) {}

  async executeActionWithReceipt(input: ExecuteAdminAgentWorkflowActionInput, executionId: string) {
    return this.atomicExecutor?.execute(input, executionId) ?? null;
  }

  async executeAction(
    input: ExecuteAdminAgentWorkflowActionInput,
  ): Promise<AdminAgentWorkflowActionExecutionResult> {
    const actionKey = toActionKey(input);
    const handler = this.handlers.find((candidate) => candidate.actionKey === actionKey);

    if (!handler) {
      throw new AdminAgentWorkflowActionUnsupportedError(input.action, input.subject);
    }

    return handler.execute(input);
  }
}

function toActionKey(input: ExecuteAdminAgentWorkflowActionInput) {
  return `${input.subject}.${input.action}` as const;
}

export { ExecuteAdminAgentWorkflowActionUseCase };
