import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminAgentChatMessageRepository,
  RecordAdminAgentConversationMessageInput,
} from "../domain/admin-agent-chat-message.repository";

@Injectable()
class PrismaAdminAgentChatMessageRepository implements AdminAgentChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listConversationMessages(input: { conversationId: string; limit: number }) {
    const records = await this.prisma.adminAgentConversationMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      where: {
        content: {
          not: "",
        },
        conversationId: input.conversationId,
        role: {
          in: ["ASSISTANT", "USER"],
        },
      },
    });

    return records.reverse().map((record) => ({
      content: record.content,
      createdAt: record.createdAt,
      id: record.id,
      role: record.role === "USER" ? ("USER" as const) : ("ASSISTANT" as const),
    }));
  }

  async recordMessage(input: RecordAdminAgentConversationMessageInput) {
    await this.prisma.adminAgentConversationMessage.create({
      data: {
        actorUserId: input.actorUserId ?? undefined,
        content: input.content,
        conversationId: input.conversationId,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
        role: input.role,
      },
    });
  }
}

export { PrismaAdminAgentChatMessageRepository };
