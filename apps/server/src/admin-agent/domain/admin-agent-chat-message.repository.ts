import type { ActivityMessage, AssistantMessage, ToolMessage, UserMessage } from "@ag-ui/core";

type AdminAgentUserMessage = Omit<UserMessage, "content"> & { content: string };
type AdminAgentMessage = ActivityMessage | AssistantMessage | ToolMessage | AdminAgentUserMessage;

type RecordAdminAgentMessageInput = {
  actorUserId?: string | null;
  conversationId: string;
  message: AdminAgentMessage;
};

interface AdminAgentChatMessageRepository {
  listConversationMessages(input: {
    conversationId: string;
    limit: number;
  }): Promise<AdminAgentMessage[]>;
  recordMessage(input: RecordAdminAgentMessageInput): Promise<void>;
}

const ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY = Symbol("ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY");

export { ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY };
export type { AdminAgentChatMessageRepository, AdminAgentMessage, RecordAdminAgentMessageInput };
