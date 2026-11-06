import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import { recordPrismaAdminOperation } from "../../audit/infrastructure/prisma-admin-operation-log.repository";
import { UpdateAdminSiteAnnouncementUseCase } from "../../site-config/application/update-admin-site-announcement.use-case";
import { updatePrismaSiteAnnouncement } from "../../site-config/infrastructure/prisma-site-config.repository";
import { SiteConfigAgentActionHandler } from "../application/site-config-agent-action.handler";
import type {
  AdminAgentAtomicActionExecutor,
  AdminAgentWorkflowActionExecutionResult,
  ExecuteAdminAgentWorkflowActionInput,
} from "../domain/admin-agent-workflow-action-executor";
import { assertAdminAgentWorkflowActionExecutionMatchesInput } from "../domain/admin-agent-workflow-action-execution.entity";

/** Commits the site update, audit entry, and execution receipt in one PostgreSQL transaction. */
@Injectable()
class PrismaAdminAgentAtomicActionExecutor implements AdminAgentAtomicActionExecutor {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ExecuteAdminAgentWorkflowActionInput,
    executionId: string,
  ): Promise<AdminAgentWorkflowActionExecutionResult | null> {
    if (input.subject !== "SITE_CONFIG" || input.action !== "UPDATE_SITE_ANNOUNCEMENT") return null;
    return this.prisma.$transaction(async (transaction) => {
      // A conditional update locks the running receipt without overwriting a committed result.
      await transaction.adminAgentWorkflowActionExecution.updateMany({
        where: { id: executionId, status: "RUNNING" },
        data: { status: "RUNNING" },
      });
      const receipt = await transaction.adminAgentWorkflowActionExecution.findUnique({
        where: { id: executionId },
      });
      if (!receipt) throw new Error(`Agent action execution not found: ${executionId}`);
      assertAdminAgentWorkflowActionExecutionMatchesInput(
        {
          action: receipt.action,
          approvalId: receipt.approvalId,
          payload: receipt.payload as Record<string, unknown>,
          subject: receipt.subject as ExecuteAdminAgentWorkflowActionInput["subject"],
        },
        {
          ...input,
          runId: receipt.runId,
          approvalId: receipt.approvalId,
        },
      );
      if (receipt.status === "SUCCEEDED") {
        if (!receipt.result) throw new Error("Agent action receipt is missing its result.");
        return receipt.result as AdminAgentWorkflowActionExecutionResult;
      }
      const handler = new SiteConfigAgentActionHandler(
        new RecordAdminOperationUseCase({
          record: (record) => recordPrismaAdminOperation(transaction.adminOperationLog, record),
        }),
        new UpdateAdminSiteAnnouncementUseCase({
          updateAnnouncement: (update) =>
            updatePrismaSiteAnnouncement(transaction.siteAnnouncement, update),
        }),
      );
      const result = await handler.execute(input);
      await transaction.adminAgentWorkflowActionExecution.update({
        where: { id: executionId },
        data: { status: "SUCCEEDED", errorMessage: null, result: result as Prisma.InputJsonObject },
      });
      return result;
    });
  }
}

export { PrismaAdminAgentAtomicActionExecutor };
