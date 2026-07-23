import { Inject, Injectable } from "@nestjs/common";
import { ListAdminArticleCommentsUseCase } from "../../../comments/application/list-admin-article-comments.use-case";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../../audit/domain/admin-operation-log";
import { createLocalDayRange } from "../../application/get-admin-agent-home.use-case";
import { ManageAdminAgentWorkflowsUseCase } from "../../application/manage-admin-agent-workflows.use-case";
import { ModerateAdminAgentCommentAnalysisUseCase } from "../../application/moderate-admin-agent-comment-analysis.use-case";
import type {
  AdminAgentServerTool,
  AdminAgentServerToolExecutionContext,
} from "../../domain/admin-agent-chat-runner";
import {
  ADMIN_AGENT_REPOSITORY,
  type AdminAgentRepository,
} from "../../domain/admin-agent.repository";
import {
  createCommentAnalysisActivityMessage,
  isFindingActionable,
} from "../admin-agent-comment-analysis-a2ui";

type AdminAgentCommentToolsContext = {
  actor: AdminOperationActor;
  requestContext?: AdminOperationRequestContext;
  startedByUserId: string;
};

const maxCommentSelection = 50;
const defaultCommentSearchLimit = 20;

@Injectable()
class AdminAgentCommentTools {
  constructor(
    private readonly listAdminArticleComments: ListAdminArticleCommentsUseCase,
    private readonly manageAdminAgentWorkflows: ManageAdminAgentWorkflowsUseCase,
    private readonly moderateCommentAnalysis: ModerateAdminAgentCommentAnalysisUseCase,
    @Inject(ADMIN_AGENT_REPOSITORY)
    private readonly adminAgentRepository: AdminAgentRepository,
  ) {}

  create(context: AdminAgentCommentToolsContext): AdminAgentServerTool[] {
    return [
      {
        description:
          "Find article comments without analyzing them. Translate natural-language constraints into structured filters: article title or slug, author, comment text, visibility, common relative periods, or an inclusive YYYY-MM-DD date range. Returns trusted comment IDs and excerpts for later tools.",
        execute: (argumentsValue) => this.searchComments(argumentsValue),
        name: "search_comments",
        parameters: {
          additionalProperties: false,
          properties: {
            articleId: {
              description: "Optional exact article ID.",
              type: "string",
            },
            articleSlug: {
              description: "Optional partial article slug.",
              type: "string",
            },
            articleTitle: {
              description: "Optional partial article title, for requests such as 某篇文章下的评论.",
              type: "string",
            },
            author: {
              description: "Optional partial author login or display name.",
              type: "string",
            },
            content: {
              description: "Optional text contained in the comment body.",
              type: "string",
            },
            dateRange: {
              additionalProperties: false,
              description:
                "Optional local-calendar range. Both boundaries are inclusive and use YYYY-MM-DD. Overrides period.",
              properties: {
                from: { description: "Inclusive start date in YYYY-MM-DD.", type: "string" },
                to: { description: "Inclusive end date in YYYY-MM-DD.", type: "string" },
              },
              type: "object",
            },
            limit: {
              default: defaultCommentSearchLimit,
              description: "Maximum comments to return, from 1 to 50.",
              maximum: maxCommentSelection,
              minimum: 1,
              type: "integer",
            },
            period: {
              default: "ALL",
              description:
                "Common server-local period inferred from natural language. Use ALL when the administrator gives no time constraint.",
              enum: ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "ALL"],
              type: "string",
            },
            query: {
              description:
                "Optional broad fallback keyword matched across comment, author, article title, and slug. Prefer the specific fields when the user names one.",
              type: "string",
            },
            sort: {
              default: "NEWEST",
              enum: ["NEWEST", "OLDEST"],
              type: "string",
            },
            status: {
              default: "VISIBLE",
              enum: ["VISIBLE", "HIDDEN", "ALL"],
              type: "string",
            },
          },
          type: "object",
        },
      },
      {
        description:
          "Analyze selected visible comments for moderation risk. Accepts only trusted comment IDs from search_comments or explicit administrator context. Persists findings, never changes visibility, and emits a durable A2UI review activity.",
        execute: (argumentsValue) => this.analyzeComments(argumentsValue, context),
        name: "analyze_comments",
        parameters: {
          additionalProperties: false,
          properties: {
            commentIds: {
              description: "Unique visible comment IDs to analyze, from 1 to 50.",
              items: { type: "string" },
              maxItems: maxCommentSelection,
              minItems: 1,
              type: "array",
            },
            objective: {
              default: "MODERATION_RISK",
              enum: ["MODERATION_RISK"],
              type: "string",
            },
          },
          required: ["commentIds"],
          type: "object",
        },
      },
      {
        description:
          "Hide a reviewed batch of comments. Use only after explicit administrator confirmation. Requires one analysis ID and finding IDs returned by analyze_comments, then replaces that analysis A2UI activity with current persisted statuses.",
        execute: (argumentsValue, executionContext) =>
          this.moderateComments("HIDE", argumentsValue, context, executionContext),
        name: "hide_comments",
        parameters: {
          additionalProperties: false,
          properties: {
            analysisId: {
              description: "The persisted comment analysis ID returned by analyze_comments.",
              type: "string",
            },
            findingIds: {
              description: "Unique persisted finding IDs to execute, from 1 to 50.",
              items: { type: "string" },
              maxItems: maxCommentSelection,
              minItems: 1,
              type: "array",
            },
          },
          required: ["analysisId", "findingIds"],
          type: "object",
        },
      },
      {
        description:
          "Restore a reviewed batch of comments previously hidden by this analysis. Requires explicit administrator intent, the analysis ID, and executed finding IDs.",
        execute: (argumentsValue, executionContext) =>
          this.moderateComments("RESTORE", argumentsValue, context, executionContext),
        name: "restore_comments",
        parameters: {
          additionalProperties: false,
          properties: {
            analysisId: {
              description: "The persisted comment analysis ID returned by analyze_comments.",
              type: "string",
            },
            findingIds: {
              description: "Unique executed finding IDs to restore, from 1 to 50.",
              items: { type: "string" },
              maxItems: maxCommentSelection,
              minItems: 1,
              type: "array",
            },
          },
          required: ["analysisId", "findingIds"],
          type: "object",
        },
      },
    ];
  }

  private async searchComments(argumentsValue: Record<string, unknown>) {
    const period = normalizePeriod(argumentsValue.period);
    const status = normalizeCommentStatus(argumentsValue.status);
    const limit = normalizeLimit(argumentsValue.limit);
    const dateRange = resolveCommentDateRange(argumentsValue.dateRange, period, new Date());
    const result = await this.listAdminArticleComments.execute({
      articleId: normalizeOptionalText(argumentsValue.articleId),
      articleSlug: normalizeOptionalText(argumentsValue.articleSlug),
      articleTitle: normalizeOptionalText(argumentsValue.articleTitle),
      author: normalizeOptionalText(argumentsValue.author),
      body: normalizeOptionalText(argumentsValue.content),
      createdFrom: dateRange?.from,
      createdTo: dateRange?.toExclusive,
      page: 1,
      pageSize: limit,
      search: normalizeOptionalText(argumentsValue.query),
      sort: argumentsValue.sort === "OLDEST" ? "OLDEST" : "NEWEST",
      status,
    });

    return {
      content: JSON.stringify({
        ok: true,
        result: {
          comments: result.data.map((comment) => ({
            article: comment.article,
            author: {
              id: comment.author.id,
              login: comment.author.login,
              name: comment.author.name,
            },
            createdAt: comment.createdAt.toISOString(),
            excerpt: toExcerpt(comment.body),
            id: comment.id,
            likeCount: comment.likeCount,
            parent: comment.parent
              ? {
                  authorLogin: comment.parent.author.login,
                  excerpt: toExcerpt(comment.parent.body, 140),
                  id: comment.parent.id,
                }
              : null,
            replyCount: comment.replyCount,
            status: comment.status,
          })),
          filters: {
            articleSlug: normalizeOptionalText(argumentsValue.articleSlug) ?? null,
            articleTitle: normalizeOptionalText(argumentsValue.articleTitle) ?? null,
            author: normalizeOptionalText(argumentsValue.author) ?? null,
            content: normalizeOptionalText(argumentsValue.content) ?? null,
            dateFrom: dateRange?.from.toISOString() ?? null,
            dateToExclusive: dateRange?.toExclusive.toISOString() ?? null,
            period,
            status: status ?? "ALL",
          },
          matchedCount: result.pagination.totalItems,
          truncated: result.pagination.totalItems > result.data.length,
        },
      }),
    };
  }

  private async analyzeComments(
    argumentsValue: Record<string, unknown>,
    context: AdminAgentCommentToolsContext,
  ) {
    const commentIds = normalizeCommentIds(argumentsValue.commentIds);

    if (commentIds.length === 0) {
      throw new Error("analyze_comments requires at least one valid comment ID.");
    }

    const result = await this.manageAdminAgentWorkflows.startWorkflow({
      actor: context.actor,
      input: {
        commentIds,
        objective: "MODERATION_RISK",
      },
      requestContext: context.requestContext,
      startedByUserId: context.startedByUserId,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const findings = await this.adminAgentRepository.listFindingsByIds(
      normalizeFindingIds(result.output.findingIds),
    );
    const activity = createCommentAnalysisActivityMessage({
      analysisId: result.run.id,
      analyzedCount: toSafeCount(result.output.analyzedCount, commentIds.length),
      findings,
      scope: result.output.scope,
      summary: result.summary,
    });

    return {
      activity,
      content: JSON.stringify({
        ok: true,
        result: {
          analysisId: result.run.id,
          analyzedCount: toSafeCount(result.output.analyzedCount, commentIds.length),
          findingIds: findings.map((finding) => finding.id),
          suggestedHideFindingIds: findings
            .filter(isFindingActionable)
            .map((finding) => finding.id),
          summary: result.summary,
        },
      }),
    };
  }

  private async moderateComments(
    action: "HIDE" | "RESTORE",
    argumentsValue: Record<string, unknown>,
    context: AdminAgentCommentToolsContext,
    _executionContext: AdminAgentServerToolExecutionContext,
  ) {
    const analysisId = normalizeOptionalText(argumentsValue.analysisId);
    const findingIds = normalizeFindingIds(argumentsValue.findingIds);

    if (!analysisId || findingIds.length === 0) {
      throw new Error(
        `${action === "HIDE" ? "hide_comments" : "restore_comments"} requires one analysis ID and at least one finding ID.`,
      );
    }

    const moderation = await this.moderateCommentAnalysis.execute({
      action,
      actor: context.actor,
      analysisId,
      findingIds,
      requestContext: context.requestContext,
    });
    const activity = createCommentAnalysisActivityMessage({
      analysisId: moderation.analysis.id,
      analyzedCount: toSafeCount(
        moderation.analysis.output?.analyzedCount,
        moderation.findings.length,
      ),
      findings: moderation.findings,
      scope: moderation.analysis.output?.scope,
      summary: moderation.analysis.summary ?? "评论风险分析已更新。",
    });
    const appliedCount = moderation.result.results.filter(
      (item) => item.status === "APPLIED",
    ).length;

    return {
      activity,
      content: JSON.stringify({
        ok: appliedCount === moderation.result.results.length,
        result: {
          action,
          analysisId,
          appliedCount,
          failedCount: moderation.result.results.length - appliedCount,
          results: moderation.result.results.map((item) =>
            item.status === "FAILED"
              ? {
                  error: item.error,
                  findingId: item.findingId,
                  status: item.status,
                }
              : {
                  findingId: item.findingId,
                  status: item.status,
                },
          ),
        },
      }),
    };
  }
}

function normalizeFindingIds(value: unknown) {
  return normalizeCommentIds(value);
}

function normalizeCommentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.flatMap((item) => {
        const id = typeof item === "string" ? item.trim() : "";
        return id ? [id] : [];
      }),
    ),
  ].slice(0, maxCommentSelection);
}

function normalizeLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    return defaultCommentSearchLimit;
  }

  return Math.min(Math.max(parsed, 1), maxCommentSelection);
}

type CommentSearchPeriod = "ALL" | "LAST_30_DAYS" | "LAST_7_DAYS" | "TODAY" | "YESTERDAY";

function normalizePeriod(value: unknown): CommentSearchPeriod {
  return ["ALL", "LAST_30_DAYS", "LAST_7_DAYS", "TODAY", "YESTERDAY"].includes(String(value))
    ? (value as CommentSearchPeriod)
    : "ALL";
}

function normalizeCommentStatus(value: unknown) {
  if (value === "ALL") {
    return undefined;
  }

  return value === "HIDDEN" ? ("HIDDEN" as const) : ("VISIBLE" as const);
}

function resolveCommentDateRange(
  value: unknown,
  period: CommentSearchPeriod,
  now: Date,
): { from: Date; toExclusive: Date } | null {
  if (isPlainRecord(value)) {
    const from = parseLocalDate(value.from);
    const inclusiveTo = parseLocalDate(value.to);

    if (!from && !inclusiveTo) {
      throw new Error("dateRange requires a valid from or to date in YYYY-MM-DD format.");
    }

    const fallback = createLocalDayRange(now);
    const toExclusive = inclusiveTo ? addLocalDays(inclusiveTo, 1) : fallback.todayEnd;
    const resolvedFrom = from ?? new Date(0);

    if (resolvedFrom >= toExclusive) {
      throw new Error("dateRange.from must not be after dateRange.to.");
    }

    return { from: resolvedFrom, toExclusive };
  }

  if (period === "ALL") {
    return null;
  }

  const { todayEnd, todayStart } = createLocalDayRange(now);

  if (period === "YESTERDAY") {
    return {
      from: addLocalDays(todayStart, -1),
      toExclusive: todayStart,
    };
  }

  if (period === "LAST_7_DAYS") {
    return {
      from: addLocalDays(todayStart, -6),
      toExclusive: todayEnd,
    };
  }

  if (period === "LAST_30_DAYS") {
    return {
      from: addLocalDays(todayStart, -29),
      toExclusive: todayEnd,
    };
  }

  return {
    from: todayStart,
    toExclusive: todayEnd,
  };
}

function parseLocalDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function addLocalDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function toExcerpt(value: string, limit = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function toSafeCount(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

export { AdminAgentCommentTools, resolveCommentDateRange };
export type { AdminAgentCommentToolsContext };
