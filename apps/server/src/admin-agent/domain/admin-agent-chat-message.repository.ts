import type {
  ActivityMessage,
  AssistantMessage,
  ReasoningMessage,
  ToolMessage,
  UserMessage,
} from "@ag-ui/core";

type AdminAgentUserMessage = Omit<UserMessage, "content"> & { content: string };
type AdminAgentReasoningMessage = ReasoningMessage & { durationMs?: number };
type AdminAgentMessage =
  | ActivityMessage
  | AssistantMessage
  | AdminAgentReasoningMessage
  | ToolMessage
  | AdminAgentUserMessage;

type RecordAdminAgentMessageInput = {
  actorUserId?: string | null;
  conversationId: string;
  durationMs?: number;
  message: AdminAgentMessage;
};

class AdminAgentConversationAccessError extends Error {
  constructor() {
    super("This Agent conversation belongs to another administrator.");
  }
}

interface AdminAgentChatMessageRepository {
  assertConversationAccess(input: { conversationId: string; actorUserId: string }): Promise<void>;
  listConversationMessages(input: {
    conversationId: string;
    limit: number;
  }): Promise<AdminAgentMessage[]>;
  recordMessage(input: RecordAdminAgentMessageInput): Promise<void>;
}

const ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY = Symbol("ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY");

export { ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY, AdminAgentConversationAccessError };
export type { AdminAgentChatMessageRepository, AdminAgentMessage, RecordAdminAgentMessageInput };
