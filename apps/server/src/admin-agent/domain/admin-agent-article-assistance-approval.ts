import type { AdminAgentGenericApprovalRequest } from "./admin-agent-workflow-approval";
import { toBusinessApprovalOutput } from "./admin-agent-workflow-approval";

type CreateArticleAssistanceApprovalRequestInput = {
  detailArticleId: string | null;
  output: Record<string, unknown>;
  summary?: string | null;
};

function createArticleAssistanceApprovalRequest(
  input: CreateArticleAssistanceApprovalRequestInput,
): AdminAgentGenericApprovalRequest {
  return {
    action: "REVIEW_ARTICLE_ASSISTANCE",
    payload: {
      detailArticleId: input.detailArticleId,
      output: toBusinessApprovalOutput(input.output),
    },
    question: "是否确认这次文章协作分析结果？",
    subject: "ARTICLE",
    summary: input.summary || "文章协作任务需要管理员确认。",
  };
}

export { createArticleAssistanceApprovalRequest };
export type { CreateArticleAssistanceApprovalRequestInput };
