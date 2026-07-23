type AdminAgentChatToolCall = {
  id: string;
  name: string;
  arguments: string;
};

type AdminAgentChatMessage =
  | {
      role: "assistant";
      content: string;
      toolCalls?: AdminAgentChatToolCall[];
    }
  | {
      role: "user";
      content: string;
    }
  | {
      role: "tool";
      content: string;
      toolCallId: string;
    };

type AdminAgentChatContextEntry = {
  id: string;
  title: string;
  description: string;
  value: string;
};

type AdminAgentChatReplyInput = {
  context: AdminAgentChatContextEntry[];
  message: string;
  recentMessages: AdminAgentChatMessage[];
  tools?: AdminAgentChatTool[];
};

type AdminAgentChatTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type AdminAgentServerTool = AdminAgentChatTool & {
  execute: (
    argumentsValue: Record<string, unknown>,
    context: AdminAgentServerToolExecutionContext,
  ) => Promise<AdminAgentServerToolResult>;
};

type AdminAgentServerToolExecutionContext = {
  conversationId: string;
  runId: string;
  toolCallId: string;
};

type AdminAgentServerToolResult = {
  activity?: {
    activityType: string;
    content: Record<string, unknown>;
    id: string;
    role: "activity";
  };
  content: string;
};

type AdminAgentChatRunnerEvent =
  | {
      type: "reasoningDelta";
      delta: string;
    }
  | {
      type: "textDelta";
      delta: string;
    }
  | {
      type: "toolCallStart";
      toolCallId: string;
      toolCallName: string;
    }
  | {
      type: "toolCallArgsDelta";
      toolCallId: string;
      delta: string;
    }
  | {
      type: "toolCallEnd";
      toolCallId: string;
    };

interface AdminAgentChatRunner {
  streamReply(input: AdminAgentChatReplyInput): AsyncIterable<AdminAgentChatRunnerEvent>;
}

const ADMIN_AGENT_CHAT_RUNNER = Symbol("ADMIN_AGENT_CHAT_RUNNER");

export { ADMIN_AGENT_CHAT_RUNNER };
export type {
  AdminAgentChatContextEntry,
  AdminAgentChatMessage,
  AdminAgentChatReplyInput,
  AdminAgentChatRunner,
  AdminAgentChatRunnerEvent,
  AdminAgentChatTool,
  AdminAgentChatToolCall,
  AdminAgentServerTool,
  AdminAgentServerToolExecutionContext,
  AdminAgentServerToolResult,
};
