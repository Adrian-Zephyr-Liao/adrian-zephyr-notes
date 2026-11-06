import { MessageSchema } from "@ag-ui/core";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AdminAgentConversationAccessError } from "../domain/admin-agent-chat-message.repository";
import type {
  AdminAgentChatMessageRepository,
  AdminAgentMessage,
  RecordAdminAgentMessageInput,
} from "../domain/admin-agent-chat-message.repository";

@Injectable()
class PrismaAdminAgentChatMessageRepository implements AdminAgentChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertConversationAccess(input: { conversationId: string; actorUserId: string }) {
    await this.prisma.$executeRaw`
      INSERT INTO "admin_agent_conversations" ("id", "owner_user_id")
      VALUES (${input.conversationId}, ${input.actorUserId}::uuid)
      ON CONFLICT ("id") DO NOTHING
    `;
    const conversation = await this.prisma.adminAgentConversation.findUniqueOrThrow({
      where: { id: input.conversationId },
    });
    if (conversation.ownerUserId !== input.actorUserId)
      throw new AdminAgentConversationAccessError();
  }

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

      if (!parsed.success || !isPersistedAdminAgentMessage(parsed.data)) {
        return [];
      }

      if (parsed.data.role !== "reasoning") {
        return [parsed.data];
      }

      const durationMs = toReasoningDurationMs(record.durationMs);

      return [
        {
          ...parsed.data,
          ...(durationMs === null ? {} : { durationMs }),
        },
      ];
    });
  }

  async recordMessage(input: RecordAdminAgentMessageInput) {
    const role = toAdminAgentMessageRole(input.message);
    const message = input.message as unknown as Prisma.InputJsonObject;
    const durationMs =
      input.message.role === "reasoning" ? toReasoningDurationMs(input.durationMs) : null;

    const changed = await this.prisma.$executeRaw`
      INSERT INTO "admin_agent_messages"
        ("id", "conversation_id", "role", "message", "duration_ms", "actor_user_id", "created_at", "updated_at")
      VALUES (${input.message.id}, ${input.conversationId}, ${role}::"AdminAgentMessageRole", ${JSON.stringify(message)}::jsonb,
        ${durationMs}, ${input.actorUserId ?? null}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET
        "message" = EXCLUDED."message",
        "duration_ms" = CASE WHEN ${input.durationMs !== undefined} THEN EXCLUDED."duration_ms" ELSE "admin_agent_messages"."duration_ms" END,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "admin_agent_messages"."conversation_id" = EXCLUDED."conversation_id"
        AND "admin_agent_messages"."role" = EXCLUDED."role"
        AND "admin_agent_messages"."actor_user_id" IS NOT DISTINCT FROM EXCLUDED."actor_user_id"
    `;
    if (changed !== 1) throw new AdminAgentConversationAccessError();
  }
}

function isPersistedAdminAgentMessage(message: MessageSchemaOutput): message is AdminAgentMessage {
  if (message.role === "user") {
    return typeof message.content === "string";
  }

  return ["activity", "assistant", "reasoning", "tool"].includes(message.role);
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

  if (message.role === "reasoning") {
    return "REASONING" as const;
  }

  return "USER" as const;
}

function toReasoningDurationMs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.min(Math.trunc(value), 2_147_483_647);
}

type MessageSchemaOutput = ReturnType<typeof MessageSchema.parse>;

export { PrismaAdminAgentChatMessageRepository };
