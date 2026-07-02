import { describe, expect, it } from "vitest";
import type {
  ArticleAiSummaryRepository,
  ListPendingArticleSummaryJobsInput,
  MarkArticleSummaryFailedInput,
  MarkArticleSummaryReadyInput,
  QueueArticleSummaryInput,
  QueueArticleSummaryResult,
} from "../domain/article-ai-summary.repository";
import { QueueArticleSummaryUseCase } from "./queue-article-summary.use-case";

describe("QueueArticleSummaryUseCase", () => {
  it("does not queue again when title, description, and markdown are unchanged", async () => {
    const repository = new CapturingSummaryRepository("UNCHANGED");
    const useCase = new QueueArticleSummaryUseCase(repository);

    await expect(useCase.execute(createInput())).resolves.toBe("UNCHANGED");

    expect(repository.lastQueuedInput).toMatchObject({
      articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
      promptVersion: "article-summary-v1",
    });
  });

  it("queues a pending summary when article content changes", async () => {
    const repository = new CapturingSummaryRepository("QUEUED");
    const useCase = new QueueArticleSummaryUseCase(repository);

    await useCase.execute(createInput({ markdown: "# Updated Markdown" }));

    expect(repository.lastQueuedInput?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

class CapturingSummaryRepository implements ArticleAiSummaryRepository {
  lastQueuedInput: QueueArticleSummaryInput | null = null;

  constructor(private readonly result: QueueArticleSummaryResult) {}

  async queueForArticle(input: QueueArticleSummaryInput) {
    this.lastQueuedInput = input;
    return this.result;
  }

  async findReadyByArticleId() {
    return null;
  }

  async listPendingGenerationJobs(_input: ListPendingArticleSummaryJobsInput) {
    return [];
  }

  async markGenerating() {
    return null;
  }

  async markReady(_input: MarkArticleSummaryReadyInput) {}

  async markFailed(_input: MarkArticleSummaryFailedInput) {}
}

function createInput(
  overrides: Partial<Parameters<QueueArticleSummaryUseCase["execute"]>[0]> = {},
) {
  return {
    articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
    ...overrides,
  };
}
