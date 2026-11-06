import { Logger } from "@nestjs/common";
import type { Report } from "@earendil-works/pi-durable";

const logger = new Logger("PiAdminAgentRuntime");

export function reportPiAdminAgentError(report: Report): void {
  // Error objects can contain provider credentials, prompts or business data.
  logger.error({
    message: "Pi runtime reported a failure",
    kind: report.kind,
    ...("reason" in report ? { reason: report.reason } : {}),
    ...("callback" in report ? { callback: report.callback } : {}),
    ...("extension" in report ? { extension: report.extension } : {}),
    ...("task" in report && report.task
      ? {
          taskId: report.task.id,
          taskKind: report.task.kind,
          conversationId: report.task.conversationId,
        }
      : {}),
    ...("conversationId" in report ? { conversationId: report.conversationId } : {}),
  });
}
