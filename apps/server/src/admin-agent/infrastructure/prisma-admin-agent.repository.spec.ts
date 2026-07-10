import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaAdminAgentRepository } from "./prisma-admin-agent.repository";

describe("PrismaAdminAgentRepository", () => {
  it("lists workflow runs in a deterministic newest-first order", async () => {
    const records = [createRunRecord({ id: "run-b" }), createRunRecord({ id: "run-a" })];
    const findMany = vi.fn().mockResolvedValue(records);
    const count = vi.fn().mockResolvedValue(records.length);
    const prisma = {
      $transaction: vi.fn(async (operations) => Promise.all(operations as Array<Promise<unknown>>)),
      adminAgentRun: {
        count,
        findMany,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const page = await repository.listRuns({
      page: 1,
      pageSize: 10,
    });

    expect(page.data.map((run) => run.id)).toEqual(["run-b", "run-a"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("lists the latest workflow event per run in requested run order", async () => {
    const records = [
      createWorkflowEventRecord({
        createdAt: new Date("2026-07-04T10:03:00.000Z"),
        id: "event-run-b-latest",
        runId: "run-b",
        summary: "B latest",
        type: "COMPLETED",
      }),
      createWorkflowEventRecord({
        createdAt: new Date("2026-07-04T10:02:00.000Z"),
        id: "event-run-a-latest",
        runId: "run-a",
        summary: "A latest",
        type: "FAILED",
      }),
      createWorkflowEventRecord({
        createdAt: new Date("2026-07-04T10:01:00.000Z"),
        id: "event-run-a-old",
        runId: "run-a",
        summary: "A old",
        type: "RUN_CREATED",
      }),
    ];
    const findMany = vi.fn().mockResolvedValue(records);
    const repository = new PrismaAdminAgentRepository({
      adminAgentWorkflowEvent: {
        findMany,
      },
    } as never);

    const events = await repository.listLatestWorkflowEventsByRunIds(["run-a", "run-b"]);

    expect(events.map((event) => [event.runId, event.id, event.summary])).toEqual([
      ["run-a", "event-run-a-latest", "A latest"],
      ["run-b", "event-run-b-latest", "B latest"],
    ]);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: {
        runId: {
          in: ["run-a", "run-b"],
        },
      },
    });
  });

  it("returns an existing deduped workflow run when creation races", async () => {
    const existingRun = createRunRecord({
      dedupeKey: "multi-task-child:parent-run:AUDIT_REVIEW:hash",
      id: "existing-run",
      status: "COMPLETED",
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const eventCreate = vi.fn();
    const findUnique = vi.fn().mockResolvedValue(existingRun);
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          adminAgentRun: {
            create,
          },
          adminAgentWorkflowEvent: {
            create: eventCreate,
          },
        }),
      ),
      adminAgentRun: {
        findUnique,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const run = await repository.createRun({
      dedupeKey: "multi-task-child:parent-run:AUDIT_REVIEW:hash",
      id: "new-run",
      input: {},
      metadata: null,
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      startedByUserId: "admin-1",
      threadId: "new-run",
      type: "AUDIT_REVIEW",
      workflowName: "AUDIT_REVIEW",
    });

    expect(run.id).toBe("existing-run");
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        dedupeKey: "multi-task-child:parent-run:AUDIT_REVIEW:hash",
      },
    });
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("does not hide unique constraint failures for non-deduped workflow runs", async () => {
    const error = createUniqueConstraintError();
    const create = vi.fn().mockRejectedValue(error);
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          adminAgentRun: {
            create,
          },
          adminAgentWorkflowEvent: {
            create: vi.fn(),
          },
        }),
      ),
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    await expect(
      repository.createRun({
        dedupeKey: null,
        id: "run-1",
        input: {},
        metadata: null,
        parentRunId: null,
        parentRunRelation: null,
        startedByUserId: "admin-1",
        threadId: "run-1",
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      }),
    ).rejects.toBe(error);
  });

  it("persists the business approval node when a workflow is interrupted", async () => {
    const runUpdate = vi.fn().mockResolvedValue(
      createRunRecord({
        currentNode: "request_site_config_approval",
        interruption: {
          kind: "ADMIN_AGENT_APPROVAL",
        },
        status: "WAITING_FOR_APPROVAL",
        summary: "站点配置巡检需要管理员确认。",
      }),
    );
    const eventCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          adminAgentRun: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: runUpdate,
          },
          adminAgentWorkflowEvent: {
            create: eventCreate,
          },
        }),
      ),
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const run = await repository.markRunInterrupted(
      "run-1",
      {
        kind: "ADMIN_AGENT_APPROVAL",
      },
      "站点配置巡检需要管理员确认。",
      {
        approvalNode: "request_site_config_approval",
      },
    );

    expect(run.currentNode).toBe("request_site_config_approval");
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentNode: "request_site_config_approval",
          status: "WAITING_FOR_APPROVAL",
        }),
        where: {
          id: "run-1",
        },
      }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          node: "request_site_config_approval",
          runId: "run-1",
          type: "INTERRUPTED",
        }),
      }),
    );
  });

  it("resets failed workflow action executions before retrying the approved write", async () => {
    const failedRecord = createWorkflowActionExecutionRecord({
      errorMessage: "Admin API request failed.",
      status: "FAILED",
    });
    const runningRecord = createWorkflowActionExecutionRecord({
      errorMessage: null,
      status: "RUNNING",
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(failedRecord)
      .mockResolvedValueOnce(runningRecord);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      adminAgentWorkflowActionExecution: {
        create,
        findUnique,
        updateMany,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const claim = await repository.ensureWorkflowActionExecution({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      payload: { announcementId: "announcement-1" },
      runId: "run-1",
      subject: "SITE_CONFIG",
    });

    expect(claim.claimStatus).toBe("CLAIMED");
    expect(claim.execution.status).toBe("RUNNING");
    expect(claim.execution.errorMessage).toBeNull();
    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        runId_approvalId: {
          approvalId: "approval-1",
          runId: "run-1",
        },
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      data: {
        errorMessage: null,
        result: Prisma.JsonNull,
        status: "RUNNING",
      },
      where: {
        id: "action-execution-1",
        status: "FAILED",
        updatedAt: failedRecord.updatedAt,
      },
    });
  });

  it("keeps fresh running workflow action executions locked against duplicate writes", async () => {
    const runningRecord = createWorkflowActionExecutionRecord({
      errorMessage: null,
      result: null,
      status: "RUNNING",
      updatedAt: new Date(),
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const findUnique = vi.fn().mockResolvedValue(runningRecord);
    const updateMany = vi.fn();
    const prisma = {
      adminAgentWorkflowActionExecution: {
        create,
        findUnique,
        updateMany,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const claim = await repository.ensureWorkflowActionExecution({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      payload: { announcementId: "announcement-1" },
      runId: "run-1",
      subject: "SITE_CONFIG",
    });

    expect(claim.claimStatus).toBe("IN_PROGRESS");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reclaims stale running workflow action executions after the lease expires", async () => {
    const staleRecord = createWorkflowActionExecutionRecord({
      errorMessage: null,
      result: null,
      status: "RUNNING",
      updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    });
    const runningRecord = createWorkflowActionExecutionRecord({
      errorMessage: null,
      result: null,
      status: "RUNNING",
      updatedAt: new Date("2026-07-04T10:10:00.000Z"),
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(staleRecord)
      .mockResolvedValueOnce(runningRecord);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      adminAgentWorkflowActionExecution: {
        create,
        findUnique,
        updateMany,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const claim = await repository.ensureWorkflowActionExecution({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      payload: { announcementId: "announcement-1" },
      runId: "run-1",
      subject: "SITE_CONFIG",
    });

    expect(claim.claimStatus).toBe("CLAIMED");
    expect(claim.execution.updatedAt).toEqual(new Date("2026-07-04T10:10:00.000Z"));
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "action-execution-1",
          status: "RUNNING",
          updatedAt: staleRecord.updatedAt,
        },
      }),
    );
  });

  it("persists cancelled workflow runs and writes a cancellation event", async () => {
    const runUpdate = vi.fn().mockResolvedValue(
      createRunRecord({
        currentNode: "cancelled",
        interruption: null,
        status: "CANCELLED",
        summary: "已取消评论治理分析。",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    );
    const eventCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          adminAgentRun: {
            update: runUpdate,
          },
          adminAgentWorkflowEvent: {
            create: eventCreate,
          },
        }),
      ),
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const run = await repository.cancelRun("run-1", "已取消评论治理分析。");

    expect(run.status).toBe("CANCELLED");
    expect(run.currentNode).toBe("cancelled");
    expect(run.interruption).toBeNull();
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentNode: "cancelled",
          interruption: Prisma.JsonNull,
          status: "CANCELLED",
          summary: "已取消评论治理分析。",
        }),
        where: {
          id: "run-1",
        },
      }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          node: "cancelled",
          runId: "run-1",
          summary: "已取消评论治理分析。",
          type: "CANCELLED",
        }),
      }),
    );
  });

  it("does not let delayed workflow writes overwrite a cancelled run", async () => {
    const cancelledRun = createRunRecord({
      currentNode: "cancelled",
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });
    const findUnique = vi.fn().mockResolvedValue(cancelledRun);
    const runUpdate = vi.fn();
    const eventCreate = vi.fn();
    const prisma = {
      adminAgentRun: {
        findUnique,
        update: runUpdate,
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          adminAgentRun: {
            findUnique,
            update: runUpdate,
          },
          adminAgentWorkflowEvent: {
            create: eventCreate,
          },
        }),
      ),
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    await expect(repository.markRunRunning("run-1")).resolves.toMatchObject({
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });
    await expect(
      repository.markRunWaitingForApproval("run-1", "迟到的等待。"),
    ).resolves.toMatchObject({
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });
    await expect(repository.markRunNode("run-1", "complete")).resolves.toBeUndefined();
    await expect(repository.completeRun("run-1", "迟到的完成。")).resolves.toMatchObject({
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });
    await expect(repository.failRun("run-1", "迟到的失败。")).resolves.toMatchObject({
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });
    await expect(
      repository.markRunInterrupted("run-1", { kind: "ADMIN_AGENT_APPROVAL" }, "迟到的中断。"),
    ).resolves.toMatchObject({
      status: "CANCELLED",
      summary: "已取消评论治理分析。",
    });

    expect(findUnique).toHaveBeenCalledTimes(6);
    expect(runUpdate).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("keeps succeeded workflow action executions immutable for idempotent replays", async () => {
    const succeededRecord = createWorkflowActionExecutionRecord({
      result: {
        appliedCount: 1,
        failedCount: 0,
        results: [{ resourceId: "announcement-1", status: "APPLIED" }],
      },
      status: "SUCCEEDED",
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const findUnique = vi.fn().mockResolvedValue(succeededRecord);
    const update = vi.fn();
    const prisma = {
      adminAgentWorkflowActionExecution: {
        create,
        findUnique,
        update,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    const claim = await repository.ensureWorkflowActionExecution({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      payload: { announcementId: "announcement-1" },
      runId: "run-1",
      subject: "SITE_CONFIG",
    });

    expect(claim.claimStatus).toBe("SUCCEEDED");
    expect(claim.execution.status).toBe("SUCCEEDED");
    expect(claim.execution.result?.appliedCount).toBe(1);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects existing workflow action executions with a different approved payload", async () => {
    const existingRecord = createWorkflowActionExecutionRecord({
      payload: { announcementId: "announcement-1" },
      status: "SUCCEEDED",
    });
    const create = vi.fn().mockRejectedValue(createUniqueConstraintError());
    const findUnique = vi.fn().mockResolvedValue(existingRecord);
    const prisma = {
      adminAgentWorkflowActionExecution: {
        create,
        findUnique,
      },
    };
    const repository = new PrismaAdminAgentRepository(prisma as never);

    await expect(
      repository.ensureWorkflowActionExecution({
        action: "UPDATE_SITE_ANNOUNCEMENT",
        approvalId: "approval-1",
        payload: { announcementId: "announcement-2" },
        runId: "run-1",
        subject: "SITE_CONFIG",
      }),
    ).rejects.toThrow(
      "Admin agent workflow action execution payload mismatch for approval: approval-1",
    );
  });
});

function createUniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
  });
}

function createRunRecord(overrides: Record<string, unknown> = {}) {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "admin-1",
    status: "RUNNING",
    summary: null,
    threadId: "run-1",
    type: "SITE_CONFIG_REVIEW",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "SITE_CONFIG_REVIEW",
    ...overrides,
  };
}

function createWorkflowEventRecord(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    id: "event-1",
    node: null,
    payload: null,
    runId: "run-1",
    summary: null,
    type: "RUN_CREATED",
    ...overrides,
  };
}

function createWorkflowActionExecutionRecord(overrides: Record<string, unknown> = {}) {
  return {
    action: "UPDATE_SITE_ANNOUNCEMENT",
    approvalId: "approval-1",
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    errorMessage: null,
    id: "action-execution-1",
    payload: { announcementId: "announcement-1" },
    result: null,
    runId: "run-1",
    status: "RUNNING",
    subject: "SITE_CONFIG",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    ...overrides,
  };
}
