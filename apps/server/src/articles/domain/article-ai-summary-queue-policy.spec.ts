import { describe, expect, it } from "vitest";
import { decideArticleAiSummaryQueue } from "./article-ai-summary-queue-policy";

describe("decideArticleAiSummaryQueue", () => {
  it("does not queue again when the content hash and prompt version are unchanged", () => {
    expect(
      decideArticleAiSummaryQueue(
        {
          contentHash: "same-hash",
          promptVersion: "article-summary-v1",
        },
        {
          articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
          contentHash: "same-hash",
          promptVersion: "article-summary-v1",
        },
      ),
    ).toBe("UNCHANGED");
  });

  it("queues again when the article content hash changes", () => {
    expect(
      decideArticleAiSummaryQueue(
        {
          contentHash: "old-hash",
          promptVersion: "article-summary-v1",
        },
        {
          articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
          contentHash: "new-hash",
          promptVersion: "article-summary-v1",
        },
      ),
    ).toBe("QUEUED");
  });
});
