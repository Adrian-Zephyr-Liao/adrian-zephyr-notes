type GenerateArticleSummaryInput = {
  description: string;
  markdown: string;
  title: string;
};

type GenerateArticleSummaryResult = {
  model: string;
  provider: string;
  text: string;
};

type ArticleSummaryGenerator = {
  generate(input: GenerateArticleSummaryInput): Promise<GenerateArticleSummaryResult>;
  isEnabled(): boolean;
};

const ARTICLE_SUMMARY_GENERATOR = Symbol("ARTICLE_SUMMARY_GENERATOR");

export { ARTICLE_SUMMARY_GENERATOR };
export type { ArticleSummaryGenerator, GenerateArticleSummaryInput, GenerateArticleSummaryResult };
