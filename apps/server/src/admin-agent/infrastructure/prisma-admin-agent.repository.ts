import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AdminAgentFindingDraft } from "../domain/admin-agent-finding.entity";
import type {
  AdminAgentRepository,
  CreateAdminAgentRunInput,
  CreateAdminAgentWorkflowEventInput,
  ListAdminAgentRunsFilters,
  ListRecentVisibleCommentsForAnalysisInput,
  ListTodayVisibleCommentsForAnalysisInput,
} from "../domain/admin-agent.repository";
import type {
  AdminAgentCommentSelectionReader,
  ListVisibleCommentsByIdsForAnalysisInput,
} from "../domain/admin-agent-comment-selection.reader";
import {
  adminAgentFindingInclude,
  agentCommentInclude,
  toAdminAgentCommentForAnalysis,
  toAdminAgentDecisionEffect,
  toAdminAgentFinding,
  toAdminAgentFindingTarget,
  toAdminAgentRun,
  toAdminAgentWorkflowActionExecution,
  toAdminAgentWorkflowEvent,
  toAdminAgentWorkflowName,
  type AdminAgentFindingRecord,
} from "./prisma-admin-agent.mapper";
import {
  createAdminAgentWorkflowCompletedEvent,
  createAdminAgentWorkflowCancelledEvent,
  createAdminAgentWorkflowFailedEvent,
  createAdminAgentWorkflowInterruptedEvent,
  createAdminAgentWorkflowNodeStartedEvent,
  createAdminAgentWorkflowRunAttemptEvent,
  createAdminAgentWorkflowRunCreatedEvent,
} from "../domain/admin-agent-workflow-lifecycle";
import {
  assertAdminAgentWorkflowActionExecutionMatchesInput,
  isAdminAgentWorkflowActionExecutionInProgress,
} from "../domain/admin-agent-workflow-action-execution.entity";
import type { AdminAgentWorkflowNode } from "../domain/admin-agent-workflow-node";

@Injectable()
class PrismaAdminAgentRepository implements AdminAgentRepository, AdminAgentCommentSelectionReader {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: CreateAdminAgentRunInput) {
    try {
      const [record] = await this.prisma.$transaction(async (tx) => {
        const createdRun = await tx.adminAgentRun.create({
          data: {
            dedupeKey: input.dedupeKey ?? undefined,
            id: input.id,
            input: input.input as Prisma.InputJsonObject,
            metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
            parentRunId: input.parentRunId ?? undefined,
            parentRunRelation: input.parentRunRelation ?? undefined,
            startedByUserId: input.startedByUserId,
            threadId: input.threadId ?? undefined,
            type: input.type,
            workflowName: input.workflowName,
          },
        });

        await createWorkflowEventRecord(
          tx,
          createAdminAgentWorkflowRunCreatedEvent({
            dedupeKey: input.dedupeKey,
            input: input.input,
            metadata: input.metadata,
            parentRunId: input.parentRunId,
            parentRunRelation: input.parentRunRelation,
            runId: createdRun.id,
            workflowName: input.workflowName,
          }),
        );

        return [createdRun];
      });

      return toAdminAgentRun(record);
    } catch (error) {
      if (!input.dedupeKey || !isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const existingRun = await this.prisma.adminAgentRun.findUnique({
        where: {
          dedupeKey: input.dedupeKey,
        },
      });

      if (!existingRun) {
        throw error;
      }

      return toAdminAgentRun(existingRun);
    }
  }

  async createWorkflowEvent(input: CreateAdminAgentWorkflowEventInput) {
    const record = await this.prisma.adminAgentWorkflowEvent.create({
      data: {
        node: input.node ?? undefined,
        payload: input.payload ? (input.payload as Prisma.InputJsonObject) : undefined,
        runId: input.runId,
        summary: input.summary ?? undefined,
        type: input.type,
      },
    });

    return toAdminAgentWorkflowEvent(record);
  }

  async ensureWorkflowActionExecution(
    input: Parameters<AdminAgentRepository["ensureWorkflowActionExecution"]>[0],
  ) {
    try {
      const record = await this.prisma.adminAgentWorkflowActionExecution.create({
        data: {
          action: input.action,
          approvalId: input.approvalId,
          payload: input.payload as Prisma.InputJsonObject,
          runId: input.runId,
          subject: input.subject,
        },
      });

      return {
        claimStatus: "CLAIMED" as const,
        execution: toAdminAgentWorkflowActionExecution(record),
      };
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
    }

    const record = await this.prisma.adminAgentWorkflowActionExecution.findUnique({
      where: {
        runId_approvalId: {
          approvalId: input.approvalId,
          runId: input.runId,
        },
      },
    });

    if (!record) {
      throw new Error(`Admin agent workflow action execution not found: ${input.approvalId}`);
    }

    const execution = toAdminAgentWorkflowActionExecution(record);
    assertAdminAgentWorkflowActionExecutionMatchesInput(execution, input);

    if (record.status === "SUCCEEDED") {
      return {
        claimStatus: "SUCCEEDED" as const,
        execution,
      };
    }

    if (isAdminAgentWorkflowActionExecutionInProgress(execution)) {
      return {
        claimStatus: "IN_PROGRESS" as const,
        execution,
      };
    }

    const claimResult = await this.prisma.adminAgentWorkflowActionExecution.updateMany({
      data: {
        errorMessage: null,
        result: Prisma.JsonNull,
        status: "RUNNING",
      },
      where: {
        id: record.id,
        status: record.status,
        updatedAt: record.updatedAt,
      },
    });

    const runningRecord = await this.prisma.adminAgentWorkflowActionExecution.findUnique({
      where: {
        runId_approvalId: {
          approvalId: input.approvalId,
          runId: input.runId,
        },
      },
    });

    if (!runningRecord) {
      throw new Error(`Admin agent workflow action execution not found: ${input.approvalId}`);
    }

    if (claimResult.count === 0) {
      if (runningRecord.status === "SUCCEEDED") {
        return {
          claimStatus: "SUCCEEDED" as const,
          execution: toAdminAgentWorkflowActionExecution(runningRecord),
        };
      }

      return {
        claimStatus: "IN_PROGRESS" as const,
        execution: toAdminAgentWorkflowActionExecution(runningRecord),
      };
    }

    return {
      claimStatus: "CLAIMED" as const,
      execution: toAdminAgentWorkflowActionExecution(runningRecord),
    };
  }

  async markWorkflowActionExecutionSucceeded(
    id: string,
    result: Parameters<AdminAgentRepository["markWorkflowActionExecutionSucceeded"]>[1],
  ) {
    const record = await this.prisma.adminAgentWorkflowActionExecution.update({
      data: {
        errorMessage: null,
        result: result as Prisma.InputJsonObject,
        status: "SUCCEEDED",
      },
      where: { id },
    });

    return toAdminAgentWorkflowActionExecution(record);
  }

  async markWorkflowActionExecutionFailed(id: string, errorMessage: string) {
    const record = await this.prisma.adminAgentWorkflowActionExecution.update({
      data: {
        errorMessage,
        status: "FAILED",
      },
      where: { id },
    });

    return toAdminAgentWorkflowActionExecution(record);
  }

  async findRunById(id: string) {
    const record = await this.prisma.adminAgentRun.findUnique({
      where: { id },
    });

    return record ? toAdminAgentRun(record) : null;
  }

  async findRunByThreadId(threadId: string) {
    const record = await this.prisma.adminAgentRun.findUnique({
      where: { threadId },
    });

    return record ? toAdminAgentRun(record) : null;
  }

  async listRuns(filters: ListAdminAgentRunsFilters) {
    const where = createAdminAgentRunWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.adminAgentRun.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        where,
      }),
      this.prisma.adminAgentRun.count({ where }),
    ]);

    return {
      data: records.map(toAdminAgentRun),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async listWorkflowEventsByRunId(runId: string) {
    const records = await this.prisma.adminAgentWorkflowEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { runId },
    });

    return records.map(toAdminAgentWorkflowEvent);
  }

  async listLatestWorkflowEventsByRunIds(runIds: string[]) {
    if (runIds.length === 0) {
      return [];
    }

    const records = await this.prisma.adminAgentWorkflowEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: {
        runId: {
          in: [...new Set(runIds)],
        },
      },
    });
    const latestEventsByRunId = new Map<string, (typeof records)[number]>();

    for (const record of records) {
      if (!latestEventsByRunId.has(record.runId)) {
        latestEventsByRunId.set(record.runId, record);
      }
    }

    return runIds
      .map((runId) => latestEventsByRunId.get(runId))
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .map(toAdminAgentWorkflowEvent);
  }

  async markRunRunning(id: string, options: { resumed?: boolean } = {}) {
    const [record] = await this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.adminAgentRun.findUnique({ where: { id } });

      if (existingRun?.status === "CANCELLED") {
        return [existingRun];
      }

      const updatedRun = await tx.adminAgentRun.update({
        data: {
          attemptCount: {
            increment: 1,
          },
          errorMessage: null,
          ...(options.resumed ? { lastResumedAt: new Date() } : {}),
          status: "RUNNING",
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowRunAttemptEvent({
          attemptCount: updatedRun.attemptCount,
          resumed: options.resumed === true,
          runId: id,
          workflowName: toAdminAgentWorkflowName(updatedRun.workflowName),
        }),
      );

      return [updatedRun];
    });

    return toAdminAgentRun(record);
  }

  async markRunNode(
    id: string,
    currentNode: AdminAgentWorkflowNode,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.adminAgentRun.findUnique({ where: { id } });

      if (existingRun?.status === "CANCELLED") {
        return;
      }

      const updatedRun = await tx.adminAgentRun.update({
        data: {
          currentNode,
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowNodeStartedEvent({
          node: currentNode,
          payload: metadata,
          runId: id,
          workflowName: toAdminAgentWorkflowName(updatedRun.workflowName),
        }),
      );
    });
  }

  async markRunInterrupted(
    id: string,
    interruption: Record<string, unknown>,
    summary: string,
    options: Parameters<AdminAgentRepository["markRunInterrupted"]>[3] = {},
  ) {
    const approvalNode = options.approvalNode ?? "human_approval";
    const [record] = await this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.adminAgentRun.findUnique({ where: { id } });

      if (existingRun?.status === "CANCELLED") {
        return [existingRun];
      }

      const updatedRun = await tx.adminAgentRun.update({
        data: {
          currentNode: approvalNode,
          errorMessage: null,
          interruption: interruption as Prisma.InputJsonObject,
          status: "WAITING_FOR_APPROVAL",
          summary,
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowInterruptedEvent({
          approvalNode,
          interruption,
          runId: id,
          summary,
        }),
      );

      return [updatedRun];
    });

    return toAdminAgentRun(record);
  }

  async markRunWaitingForApproval(id: string, summary: string) {
    const existingRun = await this.prisma.adminAgentRun.findUnique({ where: { id } });

    if (existingRun?.status === "CANCELLED") {
      return toAdminAgentRun(existingRun);
    }

    const record = await this.prisma.adminAgentRun.update({
      data: {
        errorMessage: null,
        status: "WAITING_FOR_APPROVAL",
        summary,
      },
      where: { id },
    });

    return toAdminAgentRun(record);
  }

  async completeRun(id: string, summary: string, output: Record<string, unknown> | null = null) {
    const [record] = await this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.adminAgentRun.findUnique({ where: { id } });

      if (existingRun?.status === "CANCELLED") {
        return [existingRun];
      }

      const updatedRun = await tx.adminAgentRun.update({
        data: {
          currentNode: "completed",
          errorMessage: null,
          interruption: Prisma.JsonNull,
          output: output ? (output as Prisma.InputJsonObject) : Prisma.JsonNull,
          status: "COMPLETED",
          summary,
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowCompletedEvent({
          runId: id,
          summary,
        }),
      );

      return [updatedRun];
    });

    return toAdminAgentRun(record);
  }

  async cancelRun(id: string, summary: string) {
    const [record] = await this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.adminAgentRun.update({
        data: {
          currentNode: "cancelled",
          errorMessage: null,
          interruption: Prisma.JsonNull,
          status: "CANCELLED",
          summary,
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowCancelledEvent({
          runId: id,
          summary,
        }),
      );

      return [updatedRun];
    });

    return toAdminAgentRun(record);
  }

  async failRun(id: string, errorMessage: string) {
    const [record] = await this.prisma.$transaction(async (tx) => {
      const existingRun = await tx.adminAgentRun.findUnique({ where: { id } });

      if (existingRun?.status === "CANCELLED") {
        return [existingRun];
      }

      const updatedRun = await tx.adminAgentRun.update({
        data: {
          currentNode: "failed",
          errorMessage,
          status: "FAILED",
        },
        where: { id },
      });

      await createWorkflowEventRecord(
        tx,
        createAdminAgentWorkflowFailedEvent({
          errorMessage,
          runId: id,
        }),
      );

      return [updatedRun];
    });

    return toAdminAgentRun(record);
  }

  async ensureDecisionEffect(input: Parameters<AdminAgentRepository["ensureDecisionEffect"]>[0]) {
    const record = await this.prisma.adminAgentDecisionEffect.upsert({
      create: {
        effectKey: input.effectKey,
        findingId: input.findingId ?? undefined,
        payload: input.payload as Prisma.InputJsonObject,
        runId: input.runId,
        type: input.type,
      },
      update: {
        payload: input.payload as Prisma.InputJsonObject,
      },
      where: {
        effectKey: input.effectKey,
      },
    });

    return toAdminAgentDecisionEffect(record);
  }

  async listRepairableDecisionEffects(
    input: Parameters<AdminAgentRepository["listRepairableDecisionEffects"]>[0],
  ) {
    const records = await this.prisma.adminAgentDecisionEffect.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: input.limit,
      where: {
        runId: input.runId,
        status: {
          in: ["PENDING", "FAILED"],
        },
      },
    });

    return records.map(toAdminAgentDecisionEffect);
  }

  async markDecisionEffectSucceeded(id: string) {
    const record = await this.prisma.adminAgentDecisionEffect.update({
      data: {
        errorMessage: null,
        status: "SUCCEEDED",
      },
      where: { id },
    });

    return toAdminAgentDecisionEffect(record);
  }

  async markDecisionEffectFailed(id: string, errorMessage: string) {
    const record = await this.prisma.adminAgentDecisionEffect.update({
      data: {
        attempts: {
          increment: 1,
        },
        errorMessage,
        status: "FAILED",
      },
      where: { id },
    });

    return toAdminAgentDecisionEffect(record);
  }

  async listTodayVisibleCommentsForAnalysis(input: ListTodayVisibleCommentsForAnalysisInput) {
    const records = await this.prisma.articleComment.findMany({
      include: agentCommentInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit,
      where: {
        createdAt: {
          gte: input.todayStart,
          lt: input.todayEnd,
        },
        status: "VISIBLE",
      },
    });

    return records.map(toAdminAgentCommentForAnalysis);
  }

  async listRecentVisibleCommentsForAnalysis(input: ListRecentVisibleCommentsForAnalysisInput) {
    const records = await this.prisma.articleComment.findMany({
      include: agentCommentInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit,
      where: {
        status: "VISIBLE",
      },
    });

    return records.map(toAdminAgentCommentForAnalysis);
  }

  async listVisibleCommentsByIdsForAnalysis(input: ListVisibleCommentsByIdsForAnalysisInput) {
    const ids = [...new Set(input.ids)];

    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.articleComment.findMany({
      include: agentCommentInclude,
      orderBy: {
        createdAt: "desc",
      },
      where: {
        id: {
          in: ids,
        },
        status: "VISIBLE",
      },
    });

    return records.map(toAdminAgentCommentForAnalysis);
  }

  async findFindingById(id: string) {
    const record = await this.prisma.adminAgentFinding.findUnique({
      include: adminAgentFindingInclude,
      where: { id },
    });

    if (!record) {
      return null;
    }

    const [finding] = await this.hydrateFindings([record]);
    return finding ?? null;
  }

  async markFindingExecuted(id: string) {
    const record = await this.prisma.adminAgentFinding.update({
      data: {
        executedAt: new Date(),
        status: "EXECUTED",
      },
      include: adminAgentFindingInclude,
      where: { id },
    });
    const [finding] = await this.hydrateFindings([record]);

    if (!finding) {
      throw new Error("Admin agent finding disappeared after update.");
    }

    return finding;
  }

  async markFindingFailed(id: string) {
    const record = await this.prisma.adminAgentFinding.update({
      data: {
        status: "FAILED",
      },
      include: adminAgentFindingInclude,
      where: { id },
    });
    const [finding] = await this.hydrateFindings([record]);

    if (!finding) {
      throw new Error("Admin agent finding disappeared after update.");
    }

    return finding;
  }

  async markFindingRejected(id: string) {
    const record = await this.prisma.adminAgentFinding.update({
      data: {
        status: "REJECTED",
      },
      include: adminAgentFindingInclude,
      where: { id },
    });
    const [finding] = await this.hydrateFindings([record]);

    if (!finding) {
      throw new Error("Admin agent finding disappeared after update.");
    }

    return finding;
  }

  async markFindingRestored(id: string) {
    const record = await this.prisma.adminAgentFinding.update({
      data: {
        status: "RESTORED",
      },
      include: adminAgentFindingInclude,
      where: { id },
    });
    const [finding] = await this.hydrateFindings([record]);

    if (!finding) {
      throw new Error("Admin agent finding disappeared after update.");
    }

    return finding;
  }

  async createFindings(runId: string, findings: AdminAgentFindingDraft[]) {
    if (findings.length === 0) {
      return [];
    }

    const dedupedFindings = await this.filterNewPendingFindings(findings);

    if (dedupedFindings.length === 0) {
      return [];
    }

    await this.prisma.adminAgentFinding.createMany({
      data: dedupedFindings.map((finding) => ({
        category: finding.category,
        confidence: new Prisma.Decimal(finding.confidence.toFixed(3)),
        evidence: normalizeEvidence(finding.evidence),
        proposedAction: finding.proposedAction,
        reason: finding.reason,
        runId,
        severity: finding.severity,
        targetId: finding.targetId,
        targetType: finding.targetType,
      })),
      skipDuplicates: true,
    });

    const records = await this.prisma.adminAgentFinding.findMany({
      include: adminAgentFindingInclude,
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      where: { runId },
    });

    return this.hydrateFindings(records);
  }

  async listPendingFindingsByTargetIds(targetIds: string[]) {
    if (targetIds.length === 0) {
      return [];
    }

    const records = await this.prisma.adminAgentFinding.findMany({
      include: adminAgentFindingInclude,
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      where: {
        status: "PENDING",
        targetId: {
          in: [...new Set(targetIds)],
        },
        targetType: "ARTICLE_COMMENT",
      },
    });

    return this.hydrateFindings(records);
  }

  async listFindingsByRunId(runId: string) {
    const records = await this.prisma.adminAgentFinding.findMany({
      include: adminAgentFindingInclude,
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      where: {
        runId,
      },
    });

    return this.hydrateFindings(records);
  }

  async listFindingsByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const records = await this.prisma.adminAgentFinding.findMany({
      include: adminAgentFindingInclude,
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      where: {
        id: {
          in: uniqueIds,
        },
      },
    });

    return this.hydrateFindings(records);
  }

  private async filterNewPendingFindings(findings: AdminAgentFindingDraft[]) {
    const targetIds = [...new Set(findings.map((finding) => finding.targetId))];
    const existingPendingFindings = await this.prisma.adminAgentFinding.findMany({
      select: {
        targetId: true,
      },
      where: {
        status: "PENDING",
        targetId: {
          in: targetIds,
        },
        targetType: "ARTICLE_COMMENT",
      },
    });
    const pendingTargetIds = new Set(existingPendingFindings.map((finding) => finding.targetId));

    return findings.filter((finding) => !pendingTargetIds.has(finding.targetId));
  }

  async hydrateFindings(records: AdminAgentFindingRecord[]) {
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

function normalizeEvidence(value: string[]) {
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function createWorkflowEventRecord(
  tx: Prisma.TransactionClient,
  input: CreateAdminAgentWorkflowEventInput,
) {
  return tx.adminAgentWorkflowEvent.create({
    data: {
      node: input.node ?? undefined,
      payload: input.payload ? toPrismaJsonObject(input.payload) : undefined,
      runId: input.runId,
      summary: input.summary ?? undefined,
      type: input.type,
    },
  });
}

export { PrismaAdminAgentRepository };

function createAdminAgentRunWhere(
  filters: ListAdminAgentRunsFilters,
): Prisma.AdminAgentRunWhereInput {
  return {
    parentRunId: filters.parentRunId ?? (filters.rootOnly ? null : undefined),
    parentRunRelation: filters.parentRunRelation,
    status: filters.status,
    workflowName: filters.workflowName,
  };
}
