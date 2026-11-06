import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAdminAgentChatMessageRepository } from "../src/admin-agent/infrastructure/prisma-admin-agent-chat-message.repository";
import { AdminAgentConversationAccessError } from "../src/admin-agent/domain/admin-agent-chat-message.repository";
import { ListAdminAgentConversationMessagesUseCase } from "../src/admin-agent/application/list-admin-agent-conversation-messages.use-case";
import { SendAdminAgentChatMessageUseCase } from "../src/admin-agent/application/send-admin-agent-chat-message.use-case";
import { AdminAgentController } from "../src/admin-agent/presentation/admin-agent.controller";
import { AdminAgentCopilotKitController } from "../src/admin-agent/presentation/admin-agent-copilotkit.controller";

const databaseUrl = process.env.PI_ATOMIC_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("Pi conversation ownership on PostgreSQL", () => {
  let prisma: PrismaService;
  let repository: PrismaAdminAgentChatMessageRepository;
  const actors = [randomUUID(), randomUUID()];
  const conversations: string[] = [];
  const messageIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
    repository = new PrismaAdminAgentChatMessageRepository(prisma);
    for (const actor of actors)
      await prisma.user.create({
        data: {
          id: actor,
          githubId: `pi-owner-${actor}`,
          login: `owner-${actor}`,
          profileUrl: "https://example.test/pi-owner",
        },
      });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminAgentMessage.deleteMany({ where: { id: { in: messageIds } } });
    await prisma.adminAgentConversation.deleteMany({ where: { id: { in: conversations } } });
    await prisma.user.deleteMany({ where: { id: { in: actors } } });
    await prisma.$disconnect();
  });

  it("lets exactly one administrator win a concurrent conversation claim", async () => {
    const conversationId = randomUUID();
    conversations.push(conversationId);
    const claims = await Promise.allSettled(
      actors.map((actorUserId) =>
        repository.assertConversationAccess({ actorUserId, conversationId }),
      ),
    );
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(1);
    const rejection = claims.find((claim) => claim.status === "rejected");
    expect(rejection && rejection.status === "rejected" && rejection.reason).toBeInstanceOf(
      AdminAgentConversationAccessError,
    );
    const owner = await prisma.adminAgentConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    await expect(
      repository.assertConversationAccess({ actorUserId: owner.ownerUserId, conversationId }),
    ).resolves.toBeUndefined();
  });

  it("cannot overwrite an existing message ID through another conversation or author", async () => {
    const conversationId = randomUUID();
    const otherConversation = randomUUID();
    conversations.push(conversationId, otherConversation);
    await repository.assertConversationAccess({ actorUserId: actors[0]!, conversationId });
    await repository.assertConversationAccess({
      actorUserId: actors[1]!,
      conversationId: otherConversation,
    });
    const id = randomUUID();
    messageIds.push(id);
    await repository.recordMessage({
      actorUserId: actors[0],
      conversationId,
      message: { id, role: "user", content: "Original message" },
    });
    await expect(
      repository.recordMessage({
        actorUserId: actors[1],
        conversationId: otherConversation,
        message: { id, role: "user", content: "Forged message" },
      }),
    ).rejects.toThrow();
    await expect(
      repository.recordMessage({
        actorUserId: actors[1],
        conversationId,
        message: { id, role: "user", content: "Forged author" },
      }),
    ).rejects.toThrow();
    const saved = await prisma.adminAgentMessage.findUniqueOrThrow({ where: { id } });
    expect(saved).toMatchObject({
      conversationId,
      actorUserId: actors[0],
      message: { content: "Original message" },
    });
  });

  it("preserves reasoning duration when repairing the message projection", async () => {
    const conversationId = randomUUID();
    conversations.push(conversationId);
    await repository.assertConversationAccess({ actorUserId: actors[0]!, conversationId });
    const id = randomUUID();
    messageIds.push(id);
    const message = { id, role: "reasoning" as const, content: "检查数据。" };
    await repository.recordMessage({ conversationId, message, durationMs: 65_000 });
    await repository.recordMessage({ conversationId, message });
    expect((await prisma.adminAgentMessage.findUniqueOrThrow({ where: { id } })).durationMs).toBe(
      65_000,
    );
  });

  it("denies history GET and Stop with 403 before revealing messages or aborting another conversation", async () => {
    const conversationId = randomUUID();
    conversations.push(conversationId);
    await repository.assertConversationAccess({ actorUserId: actors[0]!, conversationId });
    const list = new ListAdminAgentConversationMessagesUseCase(repository);
    const controller = new AdminAgentController(
      {} as never,
      {} as never,
      list,
      {} as never,
      {} as never,
      repository,
    );
    const otherAdmin = { id: actors[1], login: "other-admin" } as never;
    const get = controller.listConversationMessages(conversationId, otherAdmin);
    await expect(get).rejects.toBeInstanceOf(ForbiddenException);
    await expect(get).rejects.toMatchObject({ status: 403 });
    const abortConversation = vi.fn();
    const send = new SendAdminAgentChatMessageUseCase(
      { streamReply: vi.fn(), abortConversation },
      repository,
    );
    const stop = new AdminAgentCopilotKitController(
      send,
      { create: () => [] } as never,
      repository,
    ).stopConversation(conversationId, otherAdmin);
    await expect(stop).rejects.toBeInstanceOf(ForbiddenException);
    expect(abortConversation).not.toHaveBeenCalled();
  });
});
