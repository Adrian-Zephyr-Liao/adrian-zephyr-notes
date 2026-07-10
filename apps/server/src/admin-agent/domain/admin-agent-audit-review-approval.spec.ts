import { describe, expect, it } from "vitest";
import { createAuditReviewApprovalRequest } from "./admin-agent-audit-review-approval";

describe("admin agent audit review approval", () => {
  it("creates a generic approval request for audit review", () => {
    expect(
      createAuditReviewApprovalRequest({
        logCount: 12,
        output: {
          checkpointId: "checkpoint-1",
          riskSignals: [],
          workflow: "audit_review",
        },
        summary: "审计分析完成。",
      }),
    ).toEqual({
      action: "REVIEW_AUDIT_ANALYSIS",
      payload: {
        logCount: 12,
        output: {
          riskSignals: [],
        },
      },
      question: "是否确认这次审计分析结果？",
      subject: "AUDIT_LOG",
      summary: "审计分析完成。",
    });
  });

  it("uses a business fallback summary", () => {
    expect(
      createAuditReviewApprovalRequest({
        logCount: 0,
        output: {},
      }).summary,
    ).toBe("审计分析需要管理员确认。");
  });
});
