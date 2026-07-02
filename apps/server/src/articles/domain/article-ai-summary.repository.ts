import type { ArticleAiSummary } from "./article-ai-summary.entity";

type QueueArticleSummaryInput = {
  articleId: string;
  contentHash: string;
  promptVersion: string;
};

type QueueArticleSummaryResult = "QUEUED" | "UNCHANGED";

type ArticleSummaryGenerationJob = {
  id: string;
  articleId: string;
  title: string;
  description: string;
  markdown: string;
  contentHash: string;
  promptVersion: string;
};

type ListPendingArticleSummaryJobsInput = {
  articleId?: string;
  limit: number;
  staleGeneratingBefore: Date;
};

type MarkArticleSummaryReadyInput = {
  id: string;
  model: string;
  provider: string;
  summary: string;
};

type MarkArticleSummaryFailedInput = {
  errorMessage: string;
  id: string;
};

type ArticleAiSummaryRepository = {
  findReadyByArticleId(
    articleId: string,
    contentHash: string,
    promptVersion: string,
  ): Promise<ArticleAiSummary | null>;
  listPendingGenerationJobs(
    input: ListPendingArticleSummaryJobsInput,
  ): Promise<ArticleSummaryGenerationJob[]>;
  markFailed(input: MarkArticleSummaryFailedInput): Promise<void>;
  markGenerating(id: string): Promise<ArticleSummaryGenerationJob | null>;
  markReady(input: MarkArticleSummaryReadyInput): Promise<void>;
  queueForArticle(input: QueueArticleSummaryInput): Promise<QueueArticleSummaryResult>;
};

const ARTICLE_AI_SUMMARY_REPOSITORY = Symbol("ARTICLE_AI_SUMMARY_REPOSITORY");

export { ARTICLE_AI_SUMMARY_REPOSITORY };
export type {
  ArticleAiSummaryRepository,
  ArticleSummaryGenerationJob,
  ListPendingArticleSummaryJobsInput,
  MarkArticleSummaryFailedInput,
  MarkArticleSummaryReadyInput,
  QueueArticleSummaryInput,
  QueueArticleSummaryResult,
};
