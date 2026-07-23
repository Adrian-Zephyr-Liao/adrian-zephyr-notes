import { MessageSchema } from "@ag-ui/core";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminAgentChatMessageRepository,
  AdminAgentMessage,
  RecordAdminAgentMessageInput,
} from "../domain/admin-agent-chat-message.repository";

@Injectable()
class PrismaAdminAgentChatMessageRepository implements AdminAgentChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listConversationMessages(input: { conversationId: string; limit: number }) {
    const records = await this.prisma.adminAgentMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      where: {
        conversationId: input.conversationId,
      },
    });

    return records.reverse().flatMap((record): AdminAgentMessage[] => {
      const parsed = MessageSchema.safeParse(record.message);

      return parsed.success && isPersistedAdminAgentMessage(parsed.data) ? [parsed.data] : [];
    });
  }

  async recordMessage(input: RecordAdminAgentMessageInput) {
    const role = toAdminAgentMessageRole(input.message);
    const message = input.message as unknown as Prisma.InputJsonObject;

    await this.prisma.adminAgentMessage.upsert({
      create: {
        actorUserId: input.actorUserId ?? undefined,
        conversationId: input.conversationId,
        id: input.message.id,
        message,
        role,
      },
      update: {
        actorUserId: input.actorUserId ?? undefined,
        conversationId: input.conversationId,
        message,
        role,
      },
      where: {
        id: input.message.id,
      },
    });
  }
}

function isPersistedAdminAgentMessage(message: MessageSchemaOutput): message is AdminAgentMessage {
  if (message.role === "user") {
    return typeof message.content === "string";
  }

  return ["activity", "assistant", "tool"].includes(message.role);
}

function toAdminAgentMessageRole(message: AdminAgentMessage) {
  if (message.role === "activity") {
    return "ACTIVITY" as const;
  }

  if (message.role === "assistant") {
    return "ASSISTANT" as const;
  }

  if (message.role === "tool") {
    return "TOOL" as const;
  }

  return "USER" as const;
}

type MessageSchemaOutput = ReturnType<typeof MessageSchema.parse>;

export { PrismaAdminAgentChatMessageRepository };
