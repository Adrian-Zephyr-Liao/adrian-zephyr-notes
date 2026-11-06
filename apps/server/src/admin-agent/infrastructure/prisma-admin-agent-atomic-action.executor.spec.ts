import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { PrismaAdminAgentAtomicActionExecutor } from "./prisma-admin-agent-atomic-action.executor";

const action = {
  action: "UPDATE_SITE_ANNOUNCEMENT",
  subject: "SITE_CONFIG" as const,
  actor: { id: "admin-1", login: "adrian" },
  payload: { announcementId: "announcement-1", title: "Approved title" },
};

describe("PrismaAdminAgentAtomicActionExecutor", () => {
  it("commits the update, audit and receipt together, and reuses it after a lost commit response", async () => {
    const database = createDatabase();
    database.loseCommitReply = true;
    const executor = new PrismaAdminAgentAtomicActionExecutor(database.prisma);
    await expect(executor.execute(action, "execution-1")).rejects.toThrow("commit response lost");
    expect(database.state.receipt.status).toBe("SUCCEEDED");
    expect(database.state.announcement.title).toBe("Approved title");
    expect(database.state.logs).toHaveLength(1);

    // A later human edit must survive when the durable task retries the earlier approval.
    database.state.announcement.title = "New human edit";
    expect(await executor.execute(action, "execution-1")).toMatchObject({ appliedCount: 1 });
    expect(database.state.announcement.title).toBe("New human edit");
    expect(database.state.logs).toHaveLength(1);
  });

  it("rolls back the business update when the audit cannot be stored", async () => {
    const database = createDatabase();
    database.failAudit = true;
    const executor = new PrismaAdminAgentAtomicActionExecutor(database.prisma);
    await expect(executor.execute(action, "execution-1")).rejects.toThrow("audit unavailable");
    expect(database.state.announcement.title).toBe("Original title");
    expect(database.state.logs).toHaveLength(0);
    expect(database.state.receipt.status).toBe("RUNNING");
  });

  it("rejects a stale or substituted action before modifying the target", async () => {
    const database = createDatabase();
    const executor = new PrismaAdminAgentAtomicActionExecutor(database.prisma);
    await expect(
      executor.execute(
        { ...action, payload: { ...action.payload, title: "Substituted" } },
        "execution-1",
      ),
    ).rejects.toThrow("payload mismatch");
    expect(database.state.announcement.title).toBe("Original title");
    expect(database.state.logs).toHaveLength(0);
  });
});

function createDatabase() {
  const at = new Date("2026-11-06T00:00:00Z");
  const database = {
    failAudit: false,
    loseCommitReply: false,
    state: {
      announcement: {
        id: "announcement-1",
        key: "welcome",
        title: "Original title",
        icon: "sparkles",
        iconClassName: "text-primary",
        process: "首页公告",
        status: "发布",
        command: "查看",
        output: "欢迎",
        isEnabled: true,
        sortOrder: 1,
        createdAt: at,
        updatedAt: at,
      },
      receipt: {
        id: "execution-1",
        runId: "run-1",
        approvalId: "approval-1",
        action: action.action,
        subject: action.subject,
        payload: action.payload,
        result: null as unknown,
        status: "RUNNING",
        errorMessage: null,
        createdAt: at,
        updatedAt: at,
      },
      logs: [] as unknown[],
    },
    prisma: undefined as unknown as PrismaService,
  };
  database.prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: Prisma.TransactionClient) => Promise<unknown>) => {
        const candidate = structuredClone(database.state);
        const transaction = {
          siteAnnouncement: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              Object.assign(candidate.announcement, data),
          },
          adminOperationLog: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              if (database.failAudit) throw new Error("audit unavailable");
              const log = { id: "audit-1", createdAt: at, ...data };
              candidate.logs.push(log);
              return log;
            },
          },
          adminAgentWorkflowActionExecution: {
            updateMany: async () => ({ count: 1 }),
            findUnique: async () => candidate.receipt,
            update: async ({ data }: { data: Record<string, unknown> }) =>
              Object.assign(candidate.receipt, data),
          },
        } as unknown as Prisma.TransactionClient;
        const result = await callback(transaction);
        database.state = candidate;
        if (database.loseCommitReply) {
          database.loseCommitReply = false;
          throw new Error("commit response lost");
        }
        return result;
      },
    ),
  } as unknown as PrismaService;
  return database;
}
