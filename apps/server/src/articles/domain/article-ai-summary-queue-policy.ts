import type {
  QueueArticleSummaryInput,
  QueueArticleSummaryResult,
} from "./article-ai-summary.repository";
import type { ArticleAiSummaryStatus } from "./article-ai-summary.entity";

type ArticleAiSummaryQueueState = {
  contentHash: string;
  promptVersion: string;
  status: ArticleAiSummaryStatus;
} | null;

function decideArticleAiSummaryQueue(
  current: ArticleAiSummaryQueueState,
  next: QueueArticleSummaryInput,
): QueueArticleSummaryResult {
  if (
    current?.contentHash === next.contentHash &&
    current.promptVersion === next.promptVersion &&
    current.status !== "FAILED"
  ) {
    return "UNCHANGED";
  }

  return "QUEUED";
}

export { decideArticleAiSummaryQueue };
export type { ArticleAiSummaryQueueState };
