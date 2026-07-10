import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
  type AdminAgentChatMessageRepository,
} from "../domain/admin-agent-chat-message.repository";

const defaultConversationMessageLimit = 50;
const maxConversationMessageLimit = 100;

@Injectable()
class ListAdminAgentConversationMessagesUseCase {
  constructor(
    @Inject(ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: AdminAgentChatMessageRepository,
  ) {}

  async execute(input: { conversationId: string; limit?: number }) {
    const conversationId = input.conversationId.trim();

    if (!conversationId) {
      return [];
    }

    return this.chatMessageRepository.listConversationMessages({
      conversationId: conversationId.slice(0, 200),
      limit: toConversationMessageLimit(input.limit),
    });
  }
}

function toConversationMessageLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return defaultConversationMessageLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxConversationMessageLimit);
}

export { ListAdminAgentConversationMessagesUseCase, toConversationMessageLimit };
