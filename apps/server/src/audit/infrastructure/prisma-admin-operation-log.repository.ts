import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AdminOperationLog } from "../domain/admin-operation-log";
import type {
  AdminOperationLogRepository,
  ListAdminOperationLogsFilters,
  ListAdminOperationLogsExecution,
  RecordAdminOperationInput,
} from "../domain/admin-operation-log.repository";

@Injectable()
class PrismaAdminOperationLogRepository implements AdminOperationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ListAdminOperationLogsFilters, execution?: ListAdminOperationLogsExecution) {
    const where = createAdminOperationLogWhere(filters);
    const query = {
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    } satisfies Prisma.AdminOperationLogFindManyArgs;
    if (
      execution &&
      (!Number.isSafeInteger(execution.statementTimeoutMs) ||
        execution.statementTimeoutMs < 1 ||
        execution.statementTimeoutMs > 5000)
    ) {
      throw new RangeError("Read statement timeout must be between 1 and 5000 milliseconds");
    }
    const [records, totalItems] = execution
      ? await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(execution.statementTimeoutMs)}, true)`;
            return [
              await tx.adminOperationLog.findMany(query),
              await tx.adminOperationLog.count({ where }),
            ] as const;
          },
          { timeout: execution.statementTimeoutMs * 2 + 1000 },
        )
      : await this.prisma.$transaction([
          this.prisma.adminOperationLog.findMany(query),
          this.prisma.adminOperationLog.count({ where }),
        ]);

    return {
      data: records.map(toAdminOperationLog),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async record(input: RecordAdminOperationInput) {
    return recordPrismaAdminOperation(this.prisma.adminOperationLog, input);
  }
}

/** Records through the caller's connection for atomic business effects and execution receipts. */
async function recordPrismaAdminOperation(
  logs: Prisma.TransactionClient["adminOperationLog"],
  input: RecordAdminOperationInput,
) {
  const record = await logs.create({
    data: {
      actorLogin: input.actor.login,
      actorUserId: input.actor.id,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      summary: input.summary,
      metadata: input.metadata ? toJsonObject(input.metadata) : undefined,
      ipAddress: input.requestContext?.ipAddress ?? null,
      userAgent: input.requestContext?.userAgent ?? null,
    },
  });

  return toAdminOperationLog(record);
}

function createAdminOperationLogWhere(
  filters: ListAdminOperationLogsFilters,
): Prisma.AdminOperationLogWhereInput {
  return {
    action: filters.action,
    actorLogin: filters.actorLogin
      ? {
          contains: filters.actorLogin,
          mode: "insensitive",
        }
      : undefined,
    OR: filters.search
      ? [
          {
            summary: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
          {
            resourceType: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
          {
            resourceId: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        ]
      : undefined,
  };
}

function toAdminOperationLog(record: {
  id: string;
  actorUserId: string | null;
  actorLogin: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}): AdminOperationLog {
  return {
    id: record.id,
    actorUserId: record.actorUserId,
    actorLogin: record.actorLogin,
    action: toAdminOperationLogAction(record.action),
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    summary: record.summary,
    metadata: toRecordMetadata(record.metadata),
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt,
  };
}

function toAdminOperationLogAction(value: string): AdminOperationLog["action"] {
  return value === "ARTICLE_UPDATED" ||
    value === "ARTICLE_CATEGORY_CREATED" ||
    value === "ARTICLE_CATEGORY_DELETED" ||
    value === "ARTICLE_CATEGORY_UPDATED" ||
    value === "ARTICLE_TAG_CREATED" ||
    value === "ARTICLE_TAG_DELETED" ||
    value === "ARTICLE_TAG_MERGED" ||
    value === "ARTICLE_TAG_UPDATED" ||
    value === "ARTICLE_CREATED" ||
    value === "ARTICLE_DELETED" ||
    value === "COMMENT_STATUS_UPDATED" ||
    value === "GUESTBOOK_MESSAGE_UPDATED" ||
    value === "SITE_ANNOUNCEMENT_UPDATED" ||
    value === "SITE_SETTINGS_UPDATED"
    ? value
    : "SITE_SETTINGS_UPDATED";
}

function toRecordMetadata(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

export { PrismaAdminOperationLogRepository, recordPrismaAdminOperation };
