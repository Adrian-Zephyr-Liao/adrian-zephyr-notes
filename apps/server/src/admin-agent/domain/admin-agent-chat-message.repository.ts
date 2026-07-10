type AdminAgentConversationMessageRole = "ASSISTANT" | "TOOL" | "USER";

type RecordAdminAgentConversationMessageInput = {
  actorUserId?: string | null;
  content: string;
  conversationId: string;
  metadata?: Record<string, unknown> | null;
  role: AdminAgentConversationMessageRole;
};

type AdminAgentConversationMessage = {
  content: string;
  createdAt: Date;
  id: string;
  role: "ASSISTANT" | "USER";
};

interface AdminAgentChatMessageRepository {
  listConversationMessages(input: {
    conversationId: string;
    limit: number;
  }): Promise<AdminAgentConversationMessage[]>;
  recordMessage(input: RecordAdminAgentConversationMessageInput): Promise<void>;
}

const ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY = Symbol("ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY");

export { ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY };
export type {
  AdminAgentChatMessageRepository,
  AdminAgentConversationMessage,
  AdminAgentConversationMessageRole,
  RecordAdminAgentConversationMessageInput,
};
