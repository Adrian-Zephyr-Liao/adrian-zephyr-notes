import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_AI_SUMMARY_REPOSITORY,
  type ArticleAiSummaryRepository,
} from "../domain/article-ai-summary.repository";
import {
  ARTICLE_SUMMARY_PROMPT_VERSION,
  createArticleSummaryContentHash,
} from "./article-summary-content-hash";

type QueueArticleSummaryUseCaseInput = {
  articleId: string;
  description: string;
  markdown: string;
  title: string;
};

@Injectable()
class QueueArticleSummaryUseCase {
  constructor(
    @Inject(ARTICLE_AI_SUMMARY_REPOSITORY)
    private readonly articleAiSummaryRepository: ArticleAiSummaryRepository,
  ) {}

  execute(input: QueueArticleSummaryUseCaseInput) {
    return this.articleAiSummaryRepository.queueForArticle({
      articleId: input.articleId,
      contentHash: createArticleSummaryContentHash(input),
      promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
    });
  }
}

export { QueueArticleSummaryUseCase };
export type { QueueArticleSummaryUseCaseInput };
