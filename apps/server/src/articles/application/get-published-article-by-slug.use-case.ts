import { Inject, Injectable, Logger } from "@nestjs/common";
import { ARTICLE_REPOSITORY, type ArticleRepository } from "../domain/article.repository";
import type { Article } from "../domain/article.entity";
import { ArticleSlug } from "../domain/value-objects/article-slug";
import {
  ARTICLE_SUMMARY_PROMPT_VERSION,
  createArticleSummaryContentHash,
} from "./article-summary-content-hash";
import { ArticleNotFoundError } from "./article-not-found.error";
import { GeneratePendingArticleSummariesUseCase } from "./generate-pending-article-summaries.use-case";
import { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

@Injectable()
class GetPublishedArticleBySlugUseCase {
  private readonly logger = new Logger(GetPublishedArticleBySlugUseCase.name);

  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
    private readonly queueArticleSummary: QueueArticleSummaryUseCase,
    private readonly generatePendingArticleSummaries: GeneratePendingArticleSummariesUseCase,
  ) {}

  async execute(slug: string, now = new Date()) {
    const articleSlug = ArticleSlug.create(slug);
    const article = await this.articleRepository.findPublishedBySlug(articleSlug.toString(), now);

    if (!article) {
      throw new ArticleNotFoundError(articleSlug.toString());
    }

    void this.ensureAiSummaryFresh(article);

    return article;
  }

  private async ensureAiSummaryFresh(article: Article) {
    try {
      if (isArticleAiSummaryFresh(article)) {
        return;
      }

      await this.queueArticleSummary.execute({
        articleId: article.id,
        title: article.title,
        description: article.description,
        markdown: article.markdown,
      });
      await this.generatePendingArticleSummaries.execute({ articleId: article.id, limit: 1 });
    } catch (error) {
      this.logger.warn(
        `Failed to trigger article AI summary generation for article ${article.id}: ${toErrorMessage(
          error,
        )}`,
      );
    }
  }
}

function isArticleAiSummaryFresh(article: Article) {
  const summary = article.aiSummary;

  if (!summary) {
    return false;
  }

  return summary.isReadyFor(
    createArticleSummaryContentHash({
      title: article.title,
      description: article.description,
      markdown: article.markdown,
    }),
    ARTICLE_SUMMARY_PROMPT_VERSION,
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export { GetPublishedArticleBySlugUseCase, isArticleAiSummaryFresh };
