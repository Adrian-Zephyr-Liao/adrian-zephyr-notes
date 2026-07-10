import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS,
  AdminAgentWorkflowActionUnsupportedError,
  type AdminAgentWorkflowActionExecutionResult,
  type AdminAgentWorkflowActionExecutor,
  type AdminAgentWorkflowActionHandler,
  type ExecuteAdminAgentWorkflowActionInput,
} from "../domain/admin-agent-workflow-action-executor";

@Injectable()
class ExecuteAdminAgentWorkflowActionUseCase implements AdminAgentWorkflowActionExecutor {
  constructor(
    @Inject(ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS)
    private readonly handlers: AdminAgentWorkflowActionHandler[],
  ) {}

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
