import type { AdminAgentWorkflowName } from "./admin-agent-run.entity";
import type { AdminAgentWorkflowEventType } from "./admin-agent-workflow-event.entity";
import { toAdminAgentWorkflowLabel } from "./admin-agent-workflow-metadata";
import { toAdminAgentWorkflowNodeLabel } from "./admin-agent-workflow-node";

type AdminAgentWorkflowEventSummaryInput = {
  attemptCount?: number | null;
  controlAction?: string | null;
  eventType: AdminAgentWorkflowEventType;
  node?: string | null;
  workflowName: AdminAgentWorkflowName;
};

function createAdminAgentWorkflowEventSummary(input: AdminAgentWorkflowEventSummaryInput) {
  const workflowLabel = toAdminAgentWorkflowLabel(input.workflowName);

  if (input.eventType === "RUN_CREATED") {
    return `${workflowLabel}任务已创建。`;
  }

  if (input.eventType === "RUN_ATTEMPT_STARTED") {
    const attemptCount =
      typeof input.attemptCount === "number" && input.attemptCount > 0
        ? `第 ${input.attemptCount} 次`
        : "本次";
    return `${workflowLabel}开始${attemptCount}执行。`;
  }

  if (input.eventType === "RUN_RESUMED") {
    return `${workflowLabel}已从人工确认处继续执行。`;
  }

  if (input.eventType === "CONTROLLED") {
    return `${workflowLabel}已执行「${toWorkflowControlActionLabel(input.controlAction)}」操作。`;
  }

  if (input.eventType === "NODE_STARTED") {
    return `${workflowLabel}进入「${toAdminAgentWorkflowNodeLabel(input.node)}」步骤。`;
  }

  return `${workflowLabel}状态已更新。`;
}

function toWorkflowControlActionLabel(action: string | null | undefined) {
  if (action === "branch") {
    return "另开处理";
  }

  if (action === "cancel") {
    return "取消";
  }

  if (action === "refresh") {
    return "刷新";
  }

  if (action === "retry") {
    return "重试";
  }

  if (action === "resume") {
    return "继续执行";
  }

  return "控制";
}

export { createAdminAgentWorkflowEventSummary, toAdminAgentWorkflowNodeLabel };
export type { AdminAgentWorkflowEventSummaryInput };
