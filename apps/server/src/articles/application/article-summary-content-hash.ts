import { createHash } from "node:crypto";

const ARTICLE_SUMMARY_PROMPT_VERSION = "article-summary-v1";

type ArticleSummaryContentInput = {
  description: string;
  markdown: string;
  title: string;
};

function createArticleSummaryContentHash(input: ArticleSummaryContentInput) {
  return createHash("sha256")
    .update(JSON.stringify([input.title, input.description, input.markdown]))
    .digest("hex");
}

export { ARTICLE_SUMMARY_PROMPT_VERSION, createArticleSummaryContentHash };
export type { ArticleSummaryContentInput };
