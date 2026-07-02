import type {
  QueueArticleSummaryInput,
  QueueArticleSummaryResult,
} from "./article-ai-summary.repository";

type ArticleAiSummaryQueueState = {
  contentHash: string;
  promptVersion: string;
} | null;

function decideArticleAiSummaryQueue(
  current: ArticleAiSummaryQueueState,
  next: QueueArticleSummaryInput,
): QueueArticleSummaryResult {
  if (current?.contentHash === next.contentHash && current.promptVersion === next.promptVersion) {
    return "UNCHANGED";
  }

  return "QUEUED";
}

export { decideArticleAiSummaryQueue };
export type { ArticleAiSummaryQueueState };
