import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AdminOperationLog } from "../domain/admin-operation-log";
import type {
  AdminOperationLogRepository,
  ListAdminOperationLogsFilters,
  RecordAdminOperationInput,
} from "../domain/admin-operation-log.repository";

@Injectable()
class PrismaAdminOperationLogRepository implements AdminOperationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ListAdminOperationLogsFilters) {
    const where = createAdminOperationLogWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.adminOperationLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
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
    const record = await this.prisma.adminOperationLog.create({
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
  return value === "ADMIN_AGENT_FINDING_CREATED" ||
    value === "ADMIN_AGENT_FINDING_DECIDED" ||
    value === "ADMIN_AGENT_TASK_CONTROLLED" ||
    value === "ADMIN_AGENT_TASK_RESUMED" ||
    value === "ADMIN_AGENT_TASK_STARTED" ||
    value === "ARTICLE_UPDATED" ||
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

export { PrismaAdminOperationLogRepository };
