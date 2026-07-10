import { describe, expect, it } from "vitest";
import { createArticleAssistanceApprovalRequest } from "./admin-agent-article-assistance-approval";

describe("admin agent article assistance approval", () => {
  it("creates a generic approval request for article assistance review", () => {
    expect(
      createArticleAssistanceApprovalRequest({
        detailArticleId: "article-1",
        output: {
          articleCount: 3,
          checkpointId: "checkpoint-1",
          workflow: "article_assistance",
        },
        summary: "文章分析完成。",
      }),
    ).toEqual({
      action: "REVIEW_ARTICLE_ASSISTANCE",
      payload: {
        detailArticleId: "article-1",
        output: {
          articleCount: 3,
        },
      },
      question: "是否确认这次文章协作分析结果？",
      subject: "ARTICLE",
      summary: "文章分析完成。",
    });
  });

  it("uses a business fallback summary", () => {
    expect(
      createArticleAssistanceApprovalRequest({
        detailArticleId: null,
        output: {},
      }).summary,
    ).toBe("文章协作任务需要管理员确认。");
  });
});
