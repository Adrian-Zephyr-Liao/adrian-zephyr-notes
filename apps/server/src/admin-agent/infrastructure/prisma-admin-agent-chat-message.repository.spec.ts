import { describe, expect, it, vi } from "vitest";
import { PrismaAdminAgentChatMessageRepository } from "./prisma-admin-agent-chat-message.repository";

describe("PrismaAdminAgentChatMessageRepository", () => {
  it("rejects a different administrator after reading the authoritative owner", async () => {
    const execute = vi.fn().mockResolvedValue(0);
    const repository = new PrismaAdminAgentChatMessageRepository({
      $executeRaw: execute,
      adminAgentConversation: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ownerUserId: "admin-1" }),
      },
    } as never);
    await expect(
      repository.assertConversationAccess({
        conversationId: "conversation-1",
        actorUserId: "admin-2",
      }),
    ).rejects.toThrow("another administrator");
  });

  it("restores persisted AG-UI reasoning messages", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        durationMs: 65_000,
        message: {
          content: "先检查数据完整性。",
          id: "reasoning-1",
          role: "reasoning",
        },
      },
    ]);
    const repository = new PrismaAdminAgentChatMessageRepository({
      adminAgentMessage: { findMany },
    } as never);

    await expect(
      repository.listConversationMessages({
        conversationId: "conversation-1",
        limit: 50,
      }),
    ).resolves.toEqual([
      {
        content: "先检查数据完整性。",
        durationMs: 65_000,
        id: "reasoning-1",
        role: "reasoning",
      },
    ]);
  });

  it("stores reasoning messages with the dedicated database role and duration", async () => {
    const execute = vi.fn().mockResolvedValue(1);
    const repository = new PrismaAdminAgentChatMessageRepository({ $executeRaw: execute } as never);
    await repository.recordMessage({
      conversationId: "conversation-1",
      durationMs: 65_000,
      message: { content: "先检查数据完整性。", id: "reasoning-1", role: "reasoning" },
    });
    expect(execute.mock.calls[0]).toContain("REASONING");
    expect(execute.mock.calls[0]).toContain(65_000);
  });
});
