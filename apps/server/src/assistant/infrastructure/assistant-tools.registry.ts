import { Injectable } from "@nestjs/common";
import type { AssistantAuditLogsResult, AssistantToolResult } from "@adrian-zephyr-notes/contracts";
import { ListAdminOperationLogsUseCase } from "../../audit/application/list-admin-operation-logs.use-case";
import { ListAdminArticleCommentsUseCase } from "../../comments/application/list-admin-article-comments.use-case";
import { toAdminArticleCommentListResponse } from "../../comments/infrastructure/admin-article-comments.mapper";
import { AssistantActionService } from "../application/assistant-action.service";
import type { AssistantToolsContext } from "../application/assistant-runner.port";

export type AssistantToolDefinition = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  kind: AssistantToolResult["kind"];
  readOnly: boolean;
  execute(
    args: Record<string, unknown>,
    context: {
      turnId: string;
      toolCallId: string;
      signal: AbortSignal;
    },
  ): Promise<AssistantToolResult>;
};
export class AssistantToolInputError extends Error {
  readonly code = "TOOL_INPUT_INVALID";
}
const text = { type: "string", minLength: 1, maxLength: 240 };
const uuid = { type: "string", format: "uuid" };
const pagination = {
  page: {
    type: "integer",
    minimum: 1,
    maximum: 1000,
    description:
      "页码，默认1。未指定分页只查第1页，不自动翻页。仅管理员明确要求下一页、指定页码或全部记录时改变。",
  },
  pageSize: {
    type: "integer",
    minimum: 1,
    maximum: 50,
    description:
      "每页条数，默认20。仅管理员明确指定条数或要求全部记录时改变，上限50；不为追求命中或自动浏览而改变。",
  },
};
const actions = [
  "ALL",
  "ARTICLE_CREATED",
  "ARTICLE_CATEGORY_CREATED",
  "ARTICLE_CATEGORY_DELETED",
  "ARTICLE_CATEGORY_UPDATED",
  "ARTICLE_TAG_CREATED",
  "ARTICLE_TAG_DELETED",
  "ARTICLE_TAG_MERGED",
  "ARTICLE_TAG_UPDATED",
  "ARTICLE_DELETED",
  "ARTICLE_UPDATED",
  "COMMENT_STATUS_UPDATED",
  "GUESTBOOK_MESSAGE_UPDATED",
  "SITE_ANNOUNCEMENT_UPDATED",
  "SITE_SETTINGS_UPDATED",
];
const auditSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...pagination,
    action: {
      type: "string",
      enum: actions,
      description: "管理员指定的审计动作；未限定时使用ALL。空结果不得通过改为ALL重查。",
    },
    actorLogin: {
      ...text,
      description: "管理员指定的操作者登录名，逐字保留，保留大小写和标点，不缩写或同义改写。",
    },
    search: {
      ...text,
      description:
        "审计摘要、资源类型或资源编号关键词。逐字保留管理员给定的关键词，不缩写、截断或同义改写；成功空结果也不能删除或放宽该条件重查。",
    },
  },
};
const commentsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...pagination,
    articleId: uuid,
    articleSlug: { ...text, description: "文章slug，逐字保留管理员指定值，不自行改写。" },
    articleTitle: {
      ...text,
      description: "文章标题筛选，逐字保留管理员给定的完整标题，不缩写、截断或同义改写。",
    },
    author: {
      ...text,
      description: "评论作者登录名筛选，逐字保留管理员指定值，保留大小写和标点。",
    },
    content: {
      ...text,
      description: "评论正文关键词，逐字保留管理员指定词句，不缩写、截断或同义改写。",
    },
    commentId: uuid,
    query: {
      ...text,
      description: "跨评论搜索的关键词，逐字保留管理员指定词句，不缩写、截断或同义改写。",
    },
    status: { type: "string", enum: ["ALL", "VISIBLE", "HIDDEN"] },
    sort: { type: "string", enum: ["NEWEST", "OLDEST"] },
    period: { type: "string", enum: ["ALL", "TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS"] },
    dateRange: {
      type: "object",
      additionalProperties: false,
      required: ["from", "to"],
      properties: {
        from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      },
    },
  },
};
const moderationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["commentId", "targetStatus"],
  properties: { commentId: uuid, targetStatus: { type: "string", enum: ["HIDDEN", "VISIBLE"] } },
};

@Injectable()
export class AssistantToolsRegistry {
  constructor(
    private readonly audit: ListAdminOperationLogsUseCase,
    private readonly comments: ListAdminArticleCommentsUseCase,
    private readonly action: AssistantActionService,
  ) {}

  create(context: AssistantToolsContext): AssistantToolDefinition[] {
    return [
      {
        name: "list_audit_logs",
        label: "查询审计日志",
        kind: "audit_logs",
        readOnly: true,
        description:
          "查询真实审计记录，支持page/pageSize/action/actorLogin/search，不支持日期筛选。日期是执行前置条件：审计请求含日期且管理员未明确授权忽略时，先说明限制并询问是否查看最近记录，本轮不调用任何工具，不能先查一页再说明。关键词和操作者逐字保留；成功空结果不放宽条件。默认只查page=1/pageSize=20，未明确要求不翻页。只可修正输入格式，不可改写筛选值。不得用评论查询替代审计查询。",
        parameters: auditSchema,
        execute: async (args, execution) => {
          execution.signal.throwIfAborted();
          assertNonBlankFilters(args);
          const filters = {
            page: number(args.page, 1),
            pageSize: number(args.pageSize, 20),
            action: optionalText(args.action) ?? "ALL",
            actorLogin: optionalText(args.actorLogin),
            search: optionalText(args.search),
          };
          const page = await this.audit.execute(filters, { statementTimeoutMs: 5000 });
          execution.signal.throwIfAborted();
          const data = page.data.map(
            ({ id, actorLogin, action, resourceType, resourceId, summary, createdAt }) => ({
              id,
              actorLogin,
              action,
              resourceType,
              resourceId,
              summary,
              createdAt: createdAt.toISOString(),
            }),
          );
          return {
            kind: "audit_logs",
            ok: true,
            data: {
              data,
              pagination: page.pagination,
              filters: {
                action: filters.action as AssistantAuditLogsResult["filters"]["action"],
                actorLogin: filters.actorLogin ?? null,
                search: filters.search ?? null,
              },
              queriedAt: new Date().toISOString(),
            },
          };
        },
      },
      {
        name: "search_comments",
        label: "搜索评论",
        kind: "comments",
        readOnly: true,
        description:
          "查询真实文章评论，将articleId/articleSlug/articleTitle、author、content、commentId、query、status、period/dateRange与分页条件组合查询。关键词、作者和标题逐字保留，不缩写或同义改写；成功空结果不删除或放宽条件重查。未指定分页只查page=1/pageSize=20，不自动翻页。period默认ALL；相对日期按Asia/Shanghai，dateRange.from/to是含首尾的YYYY-MM-DD。仅可修正参数格式，不改变筛选值。不修改或分析评论。",
        parameters: commentsSchema,
        execute: async (args, execution) => {
          execution.signal.throwIfAborted();
          assertNonBlankFilters(args);
          const range = resolveAssistantCommentDateRange(args);
          const filters = {
            articleId: optionalText(args.articleId),
            articleSlug: optionalText(args.articleSlug),
            articleTitle: optionalText(args.articleTitle),
            author: optionalText(args.author),
            body: optionalText(args.content),
            commentId: optionalText(args.commentId),
            search: optionalText(args.query),
            page: number(args.page, 1),
            pageSize: number(args.pageSize, 20),
            sort: optionalText(args.sort) ?? "NEWEST",
            status: optionalText(args.status) ?? "ALL",
            ...range,
          };
          const page = await this.comments.execute(
            {
              ...filters,
              status: filters.status === "ALL" ? undefined : filters.status,
            },
            { statementTimeoutMs: 5000 },
          );
          execution.signal.throwIfAborted();
          return {
            kind: "comments",
            ok: true,
            data: {
              ...toAdminArticleCommentListResponse(page),
              filters: {
                articleId: filters.articleId ?? null,
                articleSlug: filters.articleSlug ?? null,
                articleTitle: filters.articleTitle ?? null,
                author: filters.author ?? null,
                content: filters.body ?? null,
                commentId: filters.commentId ?? null,
                query: filters.search ?? null,
                status: filters.status,
                sort: filters.sort,
                period: optionalText(args.period) ?? "ALL",
                createdFrom: range.createdFrom?.toISOString() ?? null,
                createdToExclusive: range.createdTo?.toISOString() ?? null,
                page: filters.page,
                pageSize: filters.pageSize,
              },
              queriedAt: new Date().toISOString(),
            },
          };
        },
      },
      {
        name: "prepare_comment_moderation",
        label: "预览评论状态变更",
        kind: "comment_action",
        readOnly: false,
        description:
          "为单条真实commentId及targetStatus HIDDEN/VISIBLE建立待确认预览，不改变评论。只有管理员在固定卡片上确认才提交。已有预览时，聊天中的同意或确认只引导原卡片，不调用此工具，不得重复创建预览。",
        parameters: moderationSchema,
        execute: async (args, execution) => {
          execution.signal.throwIfAborted();
          assertNonBlankFilters(args);
          const data = await this.action.prepare({
            actor: context.actor,
            conversationId: context.conversationId,
            turnId: context.turnId,
            toolCallId: execution.toolCallId,
            commentId: args.commentId as string,
            targetStatus: args.targetStatus as "HIDDEN" | "VISIBLE",
          });
          execution.signal.throwIfAborted();
          return { kind: "comment_action", ok: true, data };
        },
      },
    ];
  }
}

function assertNonBlankFilters(args: Record<string, unknown>) {
  if (Object.values(args).some((value) => typeof value === "string" && !value.trim()))
    throw new AssistantToolInputError("筛选条件不能是空白文本。");
}
function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}
function number(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

export function resolveAssistantCommentDateRange(
  args: Record<string, unknown>,
  now = new Date(),
): { createdFrom?: Date; createdTo?: Date } {
  const day = 86400000;
  const offset = 8 * 60 * 60 * 1000;
  const period = args.period ?? "ALL";
  if (args.dateRange !== undefined) {
    if (period !== "ALL") throw new AssistantToolInputError("相对时间和明确日期范围不能同时使用。");
    const range = args.dateRange as { from?: unknown; to?: unknown };
    if (!range || typeof range !== "object" || Array.isArray(range))
      throw new AssistantToolInputError("日期范围无效。");
    const parse = (value: unknown) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new AssistantToolInputError("日期必须为YYYY-MM-DD。");
      const timestamp = Date.parse(`${value}T00:00:00+08:00`);
      if (
        !Number.isFinite(timestamp) ||
        new Date(timestamp + offset).toISOString().slice(0, 10) !== value
      )
        throw new AssistantToolInputError("日期不是有效日历日期。");
      return timestamp;
    };
    const from = parse(range.from),
      to = parse(range.to);
    if (to < from) throw new AssistantToolInputError("结束日期不能早于开始日期。");
    return { createdFrom: new Date(from), createdTo: new Date(to + day) };
  }
  if (period === "ALL") return {};
  if (
    typeof period !== "string" ||
    !["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS"].includes(period)
  )
    throw new AssistantToolInputError("不支持的相对时间范围。");
  const local = new Date(now.getTime() + offset);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  const days = period === "LAST_7_DAYS" ? 7 : period === "LAST_30_DAYS" ? 30 : 1;
  return period === "YESTERDAY"
    ? { createdFrom: new Date(start - day), createdTo: new Date(start) }
    : { createdFrom: new Date(start - (days - 1) * day), createdTo: new Date(start + day) };
}
