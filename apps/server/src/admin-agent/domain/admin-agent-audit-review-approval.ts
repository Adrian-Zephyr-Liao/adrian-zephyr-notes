import type { AdminAgentGenericApprovalRequest } from "./admin-agent-workflow-approval";
import { toBusinessApprovalOutput } from "./admin-agent-workflow-approval";

type CreateAuditReviewApprovalRequestInput = {
  logCount: number;
  output: Record<string, unknown>;
  summary?: string | null;
};

function createAuditReviewApprovalRequest(
  input: CreateAuditReviewApprovalRequestInput,
): AdminAgentGenericApprovalRequest {
  return {
    action: "REVIEW_AUDIT_ANALYSIS",
    payload: {
      logCount: input.logCount,
      output: toBusinessApprovalOutput(input.output),
    },
    question: "是否确认这次审计分析结果？",
    subject: "AUDIT_LOG",
    summary: input.summary || "审计分析需要管理员确认。",
  };
}

export { createAuditReviewApprovalRequest };
export type { CreateAuditReviewApprovalRequestInput };
