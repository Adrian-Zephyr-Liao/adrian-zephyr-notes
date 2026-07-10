import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminAgentFinding,
  AdminAgentProposedAction,
} from "../domain/admin-agent-finding.entity";
import type {
  AdminAgentHomeRepository,
  AdminAgentRecentAction,
  GetAdminAgentHomeSnapshotInput,
} from "../domain/admin-agent-home.repository";
import {
  adminAgentFindingInclude,
  agentCommentInclude,
  toAdminAgentFinding,
  toAdminAgentFindingTarget,
  type AdminAgentFindingRecord,
} from "./prisma-admin-agent.mapper";

const homeFindingLimit = 6;
const homeFindingCandidateLimit = 24;

@Injectable()
class PrismaAdminAgentHomeRepository implements AdminAgentHomeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getHomeSnapshot(input: GetAdminAgentHomeSnapshotInput) {
    const todayCommentWhere = createTodayCommentWhere(input);
    const todayExecutedActionWhere = createTodayExecutedActionWhere(input);
    const [
      todayCommentCount,
      todayVisibleCommentCount,
      todayHiddenCommentCount,
      pendingFindingCount,
      executedActionCount,
      findingRecords,
      recentActionRecords,
    ] = await this.prisma.$transaction([
      this.prisma.articleComment.count({ where: todayCommentWhere }),
      this.prisma.articleComment.count({
        where: {
          ...todayCommentWhere,
          status: "VISIBLE",
        },
      }),
      this.prisma.articleComment.count({
        where: {
          ...todayCommentWhere,
          status: "HIDDEN",
        },
      }),
      this.prisma.adminAgentFinding.count({
        where: {
          status: "PENDING",
        },
      }),
      this.prisma.adminOperationLog.count({ where: todayExecutedActionWhere }),
      this.prisma.adminAgentFinding.findMany({
        include: adminAgentFindingInclude,
        orderBy: {
          createdAt: "desc",
        },
        take: homeFindingCandidateLimit,
        where: createHomeFindingWhere(),
      }),
      this.prisma.adminOperationLog.findMany({
        where: createRecentActionWhere(),
        orderBy: {
          createdAt: "desc",
        },
        take: input.recentActionLimit,
      }),
    ]);

    return {
      executedActionCount,
      findings: filterHomeFindings(await this.hydrateFindings(findingRecords)).slice(
        0,
        homeFindingLimit,
      ),
      pendingFindingCount,
      recentActions: recentActionRecords.map(toRecentAction),
      todayCommentCount,
      todayHiddenCommentCount,
      todayVisibleCommentCount,
    };
  }

  private async hydrateFindings(records: AdminAgentFindingRecord[]) {
    const targetIds = [...new Set(records.map((record) => record.targetId))];
    const comments = await this.prisma.articleComment.findMany({
      include: agentCommentInclude,
      where: {
        id: {
          in: targetIds,
        },
      },
    });
    const targetById = new Map(
      comments.map((comment) => [comment.id, toAdminAgentFindingTarget(comment)]),
    );

    return records.map((record) =>
      toAdminAgentFinding(record, targetById.get(record.targetId) ?? null),
    );
  }
}

function createHomeFindingWhere(): Prisma.AdminAgentFindingWhereInput {
  return {
    OR: [
      {
        status: "PENDING",
      },
      {
        proposedAction: "HIDE_COMMENT",
        status: "EXECUTED",
        targetType: "ARTICLE_COMMENT",
      },
    ],
  };
}

function filterHomeFindings(findings: AdminAgentFinding[]) {
  return findings.filter(isHomeFindingVisible);
}

function isHomeFindingVisible(finding: AdminAgentFinding) {
  if (finding.status === "PENDING") {
    return true;
  }

  return (
    finding.status === "EXECUTED" &&
    isRestorableFinding(finding.proposedAction, finding.target?.status)
  );
}

function isRestorableFinding(
  proposedAction: AdminAgentProposedAction,
  targetStatus: NonNullable<AdminAgentFinding["target"]>["status"] | undefined,
) {
  return proposedAction === "HIDE_COMMENT" && targetStatus === "HIDDEN";
}

function createTodayCommentWhere(
  input: GetAdminAgentHomeSnapshotInput,
): Prisma.ArticleCommentWhereInput {
  return {
    createdAt: {
      gte: input.todayStart,
      lt: input.todayEnd,
    },
  };
}

function createTodayExecutedActionWhere(
  input: GetAdminAgentHomeSnapshotInput,
): Prisma.AdminOperationLogWhereInput {
  return {
    action: "COMMENT_STATUS_UPDATED",
    createdAt: {
      gte: input.todayStart,
      lt: input.todayEnd,
    },
  };
}

function createRecentActionWhere(): Prisma.AdminOperationLogWhereInput {
  return {
    action: {
      in: ["ADMIN_AGENT_FINDING_CREATED", "ADMIN_AGENT_FINDING_DECIDED", "COMMENT_STATUS_UPDATED"],
    },
  };
}

function toRecentAction(record: {
  id: string;
  actorLogin: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): AdminAgentRecentAction {
  const action = toRecentActionType(record.action);

  return {
    id: record.id,
    action,
    actorLogin: record.actorLogin,
    createdAt: record.createdAt,
    resourceId: record.resourceId,
    resourceType: record.resourceType,
    summary: toRecentActionSummary(action, record.summary, toRecordMetadata(record.metadata)),
  };
}

function toRecentActionType(value: string): AdminAgentRecentAction["action"] {
  if (
    value === "ADMIN_AGENT_FINDING_CREATED" ||
    value === "ADMIN_AGENT_FINDING_DECIDED" ||
    value === "COMMENT_STATUS_UPDATED"
  ) {
    return value;
  }

  throw new Error(`Unsupported admin agent recent action: ${value}`);
}

function toRecentActionSummary(
  action: AdminAgentRecentAction["action"],
  fallback: string,
  metadata: Record<string, unknown> | null,
) {
  if (action === "ADMIN_AGENT_FINDING_CREATED") {
    return toAgentFindingCreatedSummary(metadata?.findingCount) ?? fallback;
  }

  if (action === "ADMIN_AGENT_FINDING_DECIDED") {
    return toAgentDecisionSummary(metadata?.decision) ?? fallback;
  }

  if (metadata?.source === "admin_agent") {
    return toAgentCommentStatusSummary(metadata.status) ?? fallback;
  }

  return fallback;
}

function toAgentFindingCreatedSummary(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `Agent 已生成 ${value} 条风险建议，等待人工确认。`;
  }

  return null;
}

function toAgentDecisionSummary(value: unknown) {
  if (value === "EXECUTE_PROPOSED_ACTION") {
    return "管理员已批准 Agent 建议，执行屏蔽评论。";
  }

  if (value === "REJECT") {
    return "管理员已忽略一条 Agent 风险建议。";
  }

  if (value === "RESTORE_COMMENT") {
    return "管理员已确认 Agent 误判并恢复评论。";
  }

  return null;
}

function toAgentCommentStatusSummary(value: unknown) {
  if (value === "HIDDEN") {
    return "Agent 工作台已隐藏评论。";
  }

  if (value === "VISIBLE") {
    return "Agent 工作台已恢复评论可见。";
  }

  return null;
}

function toRecordMetadata(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export {
  PrismaAdminAgentHomeRepository,
  createHomeFindingWhere,
  createRecentActionWhere,
  createTodayExecutedActionWhere,
  filterHomeFindings,
  toRecentAction,
  toRecentActionSummary,
};
