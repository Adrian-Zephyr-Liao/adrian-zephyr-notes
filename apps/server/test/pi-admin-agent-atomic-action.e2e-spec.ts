import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAdminAgentRepository } from "../src/admin-agent/infrastructure/prisma-admin-agent.repository";
import { PrismaAdminAgentAtomicActionExecutor } from "../src/admin-agent/infrastructure/prisma-admin-agent-atomic-action.executor";
import { ExecuteAdminAgentWorkflowActionUseCase } from "../src/admin-agent/application/execute-admin-agent-workflow-action.use-case";
import { executeAdminAgentGenericApprovalAction } from "../src/admin-agent/application/execute-admin-agent-generic-approval-action";

// Run against an explicitly selected, migrated disposable database; normal unit tests never connect.
const databaseUrl = process.env.PI_ATOMIC_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("Pi action receipts on PostgreSQL", () => {
  let prisma: PrismaService;
  let repository: PrismaAdminAgentRepository;
  const actorId = randomUUID();
  const announcementId = randomUUID();
  const runIds: string[] = [];
  const actor = { id: actorId, login: "pi-atomic-test" };

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
    repository = new PrismaAdminAgentRepository(prisma);
    await prisma.user.create({
      data: {
        id: actorId,
        githubId: `pi-atomic-${actorId}`,
        login: actor.login,
        profileUrl: "https://example.test/pi",
      },
    });
    await prisma.siteAnnouncement.create({
      data: {
        id: announcementId,
        key: `pi-atomic-${announcementId}`,
        title: "Original title",
        icon: "sparkles",
        iconClassName: "text-primary",
        process: "公告",
        status: "发布",
        command: "查看",
        output: "欢迎",
        isEnabled: true,
        sortOrder: 1,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(
      "ALTER TABLE admin_operation_logs DROP CONSTRAINT IF EXISTS pi_atomic_reject_audit",
    );
    await prisma.adminOperationLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.adminAgentRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.siteAnnouncement.deleteMany({ where: { id: announcementId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("rolls back the announcement when PostgreSQL rejects the audit insert", async () => {
    const { runId, approval } = await fixture("Rollback candidate");
    const before = await prisma.siteAnnouncement.findUniqueOrThrow({
      where: { id: announcementId },
    });
    // NOT VALID leaves existing rows alone, but PostgreSQL rejects the next insert inside the transaction.
    await prisma.$executeRawUnsafe(
      "ALTER TABLE admin_operation_logs ADD CONSTRAINT pi_atomic_reject_audit CHECK (action <> 'SITE_ANNOUNCEMENT_UPDATED') NOT VALID",
    );
    try {
      await expect(
        executeAdminAgentGenericApprovalAction({
          actionExecutor: executor(prisma),
          approval,
          repository,
          runId,
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE admin_operation_logs DROP CONSTRAINT pi_atomic_reject_audit",
      );
    }
    expect(
      (await prisma.siteAnnouncement.findUniqueOrThrow({ where: { id: announcementId } })).title,
    ).toBe(before.title);
    expect(await prisma.adminOperationLog.count({ where: { actorUserId: actorId } })).toBe(0);
    const receipt = await prisma.adminAgentWorkflowActionExecution.findUniqueOrThrow({
      where: { runId_approvalId: { runId, approvalId: approval.approvalId } },
    });
    expect(receipt.status).toBe("FAILED");
    expect(receipt.result).toBeNull();
  });

  it("recovers a lost commit reply without replacing a subsequent human edit or duplicating audit", async () => {
    const { runId, approval } = await fixture("Approved title");
    let loseReply = true;
    const executeTransaction = prisma.$transaction.bind(prisma);
    const lostReplyClient = new Proxy(prisma, {
      get(target, property) {
        if (property === "$transaction")
          return async (...args: Parameters<typeof prisma.$transaction>) => {
            const result = await Reflect.apply(executeTransaction, undefined, args);
            if (loseReply) {
              loseReply = false;
              throw new Error("commit reply lost after PostgreSQL committed");
            }
            return result;
          };
        return Reflect.get(target, property);
      },
    });
    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor: executor(lostReplyClient),
        approval,
        repository,
        runId,
      }),
    ).rejects.toThrow("commit reply lost");
    const receipt = await prisma.adminAgentWorkflowActionExecution.findUniqueOrThrow({
      where: { runId_approvalId: { runId, approvalId: approval.approvalId } },
    });
    expect(receipt.status).toBe("SUCCEEDED");
    expect(
      (await prisma.siteAnnouncement.findUniqueOrThrow({ where: { id: announcementId } })).title,
    ).toBe("Approved title");
    await prisma.siteAnnouncement.update({
      where: { id: announcementId },
      data: { title: "Later human edit" },
    });
    const before = await prisma.adminOperationLog.count({ where: { actorUserId: actorId } });
    const recovered = await executeAdminAgentGenericApprovalAction({
      actionExecutor: executor(prisma),
      approval,
      repository,
      runId,
    });
    expect(recovered?.appliedCount).toBe(1);
    expect(
      (await prisma.siteAnnouncement.findUniqueOrThrow({ where: { id: announcementId } })).title,
    ).toBe("Later human edit");
    expect(await prisma.adminOperationLog.count({ where: { actorUserId: actorId } })).toBe(before);
  });

  it("serializes concurrent stale owners against one real receipt row", async () => {
    const { runId, approval } = await fixture("Concurrent title");
    const claim = await repository.ensureWorkflowActionExecution({
      action: approval.action,
      subject: approval.subject,
      payload: approval.payload,
      runId,
      approvalId: approval.approvalId,
    });
    const atomic = new PrismaAdminAgentAtomicActionExecutor(prisma);
    const before = await prisma.adminOperationLog.count({ where: { actorUserId: actorId } });
    const [first, second] = await Promise.all([
      atomic.execute({ ...approval, actor }, claim.execution.id),
      atomic.execute({ ...approval, actor }, claim.execution.id),
    ]);
    expect(first).toEqual(second);
    expect(first?.appliedCount).toBe(1);
    expect(await prisma.adminOperationLog.count({ where: { actorUserId: actorId } })).toBe(
      before + 1,
    );
  });

  it("records one cancellation event when the control plane and task abort race", async () => {
    const { runId } = await fixture("Unused approval");
    const responses = await Promise.all([
      repository.cancelRun(runId, "Control cancellation"),
      repository.cancelRun(runId, "Task abort cancellation"),
    ]);
    expect(responses.map((run) => run.status)).toEqual(["CANCELLED", "CANCELLED"]);
    await repository.cancelRun(runId, "Repeated cancellation");
    expect(
      await prisma.adminAgentWorkflowEvent.count({ where: { runId, type: "CANCELLED" } }),
    ).toBe(1);
  });

  function executor(client: PrismaService) {
    return new ExecuteAdminAgentWorkflowActionUseCase(
      [],
      new PrismaAdminAgentAtomicActionExecutor(client),
    );
  }

  async function fixture(title: string) {
    const run = await prisma.adminAgentRun.create({
      data: {
        type: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
        input: {},
        startedByUserId: actorId,
      },
    });
    runIds.push(run.id);
    return {
      runId: run.id,
      approval: {
        action: "UPDATE_SITE_ANNOUNCEMENT",
        approvalId: `site-update:${run.id}`,
        decision: "approve",
        subject: "SITE_CONFIG" as const,
        actor,
        payload: { announcementId, title },
      },
    };
  }
});
