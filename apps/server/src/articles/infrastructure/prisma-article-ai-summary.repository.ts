import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { decideArticleAiSummaryQueue } from "../domain/article-ai-summary-queue-policy";
import { ArticleAiSummary } from "../domain/article-ai-summary.entity";
import type {
  ArticleAiSummaryRepository,
  ArticleSummaryGenerationJob,
  ListPendingArticleSummaryJobsInput,
  MarkArticleSummaryFailedInput,
  MarkArticleSummaryReadyInput,
  QueueArticleSummaryInput,
  QueueArticleSummaryResult,
} from "../domain/article-ai-summary.repository";
import type { ArticleAiSummaryStatus } from "../domain/article-ai-summary.entity";

const summaryJobInclude = {
  article: true,
} satisfies Prisma.ArticleAiSummaryInclude;

type ArticleAiSummaryRecord = {
  id: string;
  articleId: string;
  summary: string | null;
  status: ArticleAiSummaryStatus;
  contentHash: string;
  promptVersion: string;
  provider: string | null;
  model: string | null;
  attemptCount: number;
  errorMessage: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ArticleSummaryJobRecord = Prisma.ArticleAiSummaryGetPayload<{
  include: typeof summaryJobInclude;
}>;

@Injectable()
class PrismaArticleAiSummaryRepository implements ArticleAiSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReadyByArticleId(articleId: string, contentHash: string, promptVersion: string) {
    const record = await this.prisma.articleAiSummary.findFirst({
      where: {
        articleId,
        contentHash,
        promptVersion,
        status: "READY",
      },
    });

    return record ? toDomainSummary(record) : null;
  }

  async listPendingGenerationJobs(input: ListPendingArticleSummaryJobsInput) {
    const where: Prisma.ArticleAiSummaryWhereInput = {
      ...(input.articleId ? { articleId: input.articleId } : {}),
      OR: [
        { status: "PENDING" },
        {
          status: "GENERATING",
          updatedAt: {
            lte: input.staleGeneratingBefore,
          },
        },
      ],
    };
    const records = await this.prisma.articleAiSummary.findMany({
      where,
      include: summaryJobInclude,
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
      take: input.limit,
    });

    return records.map(toGenerationJob);
  }

  async markGenerating(id: string) {
    try {
      const record = await this.prisma.articleAiSummary.update({
        where: { id },
        data: {
          attemptCount: {
            increment: 1,
          },
          errorMessage: null,
          status: "GENERATING",
        },
        include: summaryJobInclude,
      });

      return toGenerationJob(record);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async markReady(input: MarkArticleSummaryReadyInput) {
    await this.prisma.articleAiSummary.update({
      where: { id: input.id },
      data: {
        errorMessage: null,
        generatedAt: new Date(),
        model: input.model,
        provider: input.provider,
        status: "READY",
        summary: input.summary,
      },
    });
  }

  async markFailed(input: MarkArticleSummaryFailedInput) {
    await this.prisma.articleAiSummary.update({
      where: { id: input.id },
      data: {
        errorMessage: input.errorMessage,
        status: "FAILED",
      },
    });
  }

  async queueForArticle(input: QueueArticleSummaryInput): Promise<QueueArticleSummaryResult> {
    const current = await this.prisma.articleAiSummary.findUnique({
      where: {
        articleId: input.articleId,
      },
    });

    const decision = decideArticleAiSummaryQueue(current, input);

    if (decision === "UNCHANGED") {
      return "UNCHANGED";
    }

    await this.prisma.articleAiSummary.upsert({
      where: {
        articleId: input.articleId,
      },
      update: {
        attemptCount: 0,
        contentHash: input.contentHash,
        errorMessage: null,
        generatedAt: null,
        model: null,
        promptVersion: input.promptVersion,
        provider: null,
        status: "PENDING",
        summary: null,
      },
      create: {
        articleId: input.articleId,
        contentHash: input.contentHash,
        promptVersion: input.promptVersion,
        status: "PENDING",
      },
    });

    return decision;
  }
}

function toDomainSummary(record: ArticleAiSummaryRecord) {
  return ArticleAiSummary.create({
    id: record.id,
    articleId: record.articleId,
    summary: record.summary,
    status: record.status,
    contentHash: record.contentHash,
    promptVersion: record.promptVersion,
    provider: record.provider,
    model: record.model,
    attemptCount: record.attemptCount,
    errorMessage: record.errorMessage,
    generatedAt: record.generatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toGenerationJob(record: ArticleSummaryJobRecord): ArticleSummaryGenerationJob {
  return {
    id: record.id,
    articleId: record.articleId,
    title: record.article.title,
    description: record.article.description,
    markdown: record.article.markdown,
    contentHash: record.contentHash,
    promptVersion: record.promptVersion,
  };
}

function isRecordNotFoundError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export { PrismaArticleAiSummaryRepository, toDomainSummary };
