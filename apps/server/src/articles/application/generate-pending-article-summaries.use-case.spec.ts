import { describe, expect, it } from "vitest";
import type {
  ArticleAiSummaryRepository,
  ArticleSummaryGenerationJob,
  ListPendingArticleSummaryJobsInput,
  MarkArticleSummaryFailedInput,
  MarkArticleSummaryReadyInput,
  QueueArticleSummaryInput,
} from "../domain/article-ai-summary.repository";
import type {
  ArticleSummaryGenerator,
  GenerateArticleSummaryInput,
} from "../domain/article-summary-generator";
import { GeneratePendingArticleSummariesUseCase } from "./generate-pending-article-summaries.use-case";

describe("GeneratePendingArticleSummariesUseCase", () => {
  it("skips generation when the generator is not configured", async () => {
    const repository = new MemorySummaryRepository([createJob()]);
    const generator = new StaticSummaryGenerator({ enabled: false });
    const useCase = new GeneratePendingArticleSummariesUseCase(repository, generator);

    await expect(useCase.execute()).resolves.toEqual({
      failed: 0,
      processed: 0,
      skipped: true,
      succeeded: 0,
    });
    expect(repository.claimedIds).toEqual([]);
  });

  it("marks pending jobs ready after successful generation", async () => {
    const repository = new MemorySummaryRepository([createJob()]);
    const generator = new StaticSummaryGenerator({ text: "  这是一段摘要。  " });
    const useCase = new GeneratePendingArticleSummariesUseCase(repository, generator);

    await expect(useCase.execute()).resolves.toEqual({
      failed: 0,
      processed: 1,
      skipped: false,
      succeeded: 1,
    });
    expect(repository.readyInputs).toEqual([
      {
        id: "summary-1",
        model: "test-model",
        provider: "test",
        summary: "这是一段摘要。",
      },
    ]);
  });

  it("records failed generation without throwing to article readers", async () => {
    const repository = new MemorySummaryRepository([createJob()]);
    const generator = new StaticSummaryGenerator({ error: new Error("LLM timeout") });
    const useCase = new GeneratePendingArticleSummariesUseCase(repository, generator);

    await expect(useCase.execute()).resolves.toMatchObject({
      failed: 1,
      processed: 1,
      skipped: false,
      succeeded: 0,
    });
    expect(repository.failedInputs).toEqual([
      {
        id: "summary-1",
        errorMessage: "LLM timeout",
      },
    ]);
  });
});

class MemorySummaryRepository implements ArticleAiSummaryRepository {
  claimedIds: string[] = [];
  readyInputs: MarkArticleSummaryReadyInput[] = [];
  failedInputs: MarkArticleSummaryFailedInput[] = [];

  constructor(private readonly jobs: ArticleSummaryGenerationJob[]) {}

  async listPendingGenerationJobs(_input: ListPendingArticleSummaryJobsInput) {
    return this.jobs;
  }

  async markGenerating(id: string) {
    this.claimedIds.push(id);
    return this.jobs.find((job) => job.id === id) ?? null;
  }

  async markReady(input: MarkArticleSummaryReadyInput) {
    this.readyInputs.push(input);
  }

  async markFailed(input: MarkArticleSummaryFailedInput) {
    this.failedInputs.push(input);
  }

  async findReadyByArticleId() {
    return null;
  }

  async queueForArticle(_input: QueueArticleSummaryInput) {
    return "UNCHANGED" as const;
  }
}

class StaticSummaryGenerator implements ArticleSummaryGenerator {
  constructor(
    private readonly options: {
      enabled?: boolean;
      error?: Error;
      text?: string;
    } = {},
  ) {}

  isEnabled() {
    return this.options.enabled ?? true;
  }

  async generate(_input: GenerateArticleSummaryInput) {
    if (this.options.error) {
      throw this.options.error;
    }

    return {
      provider: "test",
      model: "test-model",
      text: this.options.text ?? "测试摘要",
    };
  }
}

function createJob(): ArticleSummaryGenerationJob {
  return {
    id: "summary-1",
    articleId: "24c86b96-1962-4a2a-8632-2d1425c45a3f",
    title: "Markdown 语法全量展示",
    description: "文章摘要",
    markdown: "# Markdown",
    contentHash: "hash",
    promptVersion: "article-summary-v1",
  };
}
