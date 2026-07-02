import { Inject, Injectable } from "@nestjs/common";
import {
  ARTICLE_AI_SUMMARY_REPOSITORY,
  type ArticleAiSummaryRepository,
} from "../domain/article-ai-summary.repository";
import {
  ARTICLE_SUMMARY_GENERATOR,
  type ArticleSummaryGenerator,
} from "../domain/article-summary-generator";

type GeneratePendingArticleSummariesInput = {
  articleId?: string;
  limit?: number;
  staleGeneratingAfterMs?: number;
};

type GeneratePendingArticleSummariesResult = {
  failed: number;
  processed: number;
  skipped: boolean;
  succeeded: number;
};

const defaultLimit = 3;
const defaultStaleGeneratingAfterMs = 10 * 60 * 1000;
const maxSummaryLength = 500;

@Injectable()
class GeneratePendingArticleSummariesUseCase {
  constructor(
    @Inject(ARTICLE_AI_SUMMARY_REPOSITORY)
    private readonly articleAiSummaryRepository: ArticleAiSummaryRepository,
    @Inject(ARTICLE_SUMMARY_GENERATOR)
    private readonly articleSummaryGenerator: ArticleSummaryGenerator,
  ) {}

  async execute(
    input: GeneratePendingArticleSummariesInput = {},
  ): Promise<GeneratePendingArticleSummariesResult> {
    if (!this.articleSummaryGenerator.isEnabled()) {
      return {
        failed: 0,
        processed: 0,
        skipped: true,
        succeeded: 0,
      };
    }

    const now = new Date();
    const jobs = await this.articleAiSummaryRepository.listPendingGenerationJobs({
      articleId: input.articleId,
      limit: input.limit ?? defaultLimit,
      staleGeneratingBefore: new Date(
        now.getTime() - (input.staleGeneratingAfterMs ?? defaultStaleGeneratingAfterMs),
      ),
    });
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      const claimedJob = await this.articleAiSummaryRepository.markGenerating(job.id);

      if (!claimedJob) {
        continue;
      }

      try {
        const generated = await this.articleSummaryGenerator.generate({
          description: claimedJob.description,
          markdown: claimedJob.markdown,
          title: claimedJob.title,
        });

        await this.articleAiSummaryRepository.markReady({
          id: claimedJob.id,
          model: generated.model,
          provider: generated.provider,
          summary: normalizeGeneratedSummary(generated.text),
        });
        succeeded += 1;
      } catch (error) {
        await this.articleAiSummaryRepository.markFailed({
          id: claimedJob.id,
          errorMessage: toGenerationErrorMessage(error),
        });
        failed += 1;
      }
    }

    return {
      failed,
      processed: succeeded + failed,
      skipped: false,
      succeeded,
    };
  }
}

function normalizeGeneratedSummary(value: string) {
  const normalized = value.trim().replaceAll(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Article AI summary generator returned empty text.");
  }

  return normalized.slice(0, maxSummaryLength);
}

function toGenerationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 1000);
  }

  return "Article AI summary generation failed.";
}

export { GeneratePendingArticleSummariesUseCase, normalizeGeneratedSummary };
export type { GeneratePendingArticleSummariesInput, GeneratePendingArticleSummariesResult };
