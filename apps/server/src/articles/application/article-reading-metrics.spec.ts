import { describe, expect, it } from "vitest";
import { calculateArticleReadingMetrics } from "./article-reading-metrics";

describe("calculateArticleReadingMetrics", () => {
  it("counts readable markdown text and returns at least one reading minute", () => {
    expect(calculateArticleReadingMetrics("# 标题\n\nhello world")).toEqual({
      readingMinutes: 1,
      wordCount: 4,
    });
  });
});
