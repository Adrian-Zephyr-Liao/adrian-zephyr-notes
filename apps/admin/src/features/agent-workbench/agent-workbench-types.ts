import type { AdminAgentCapabilityId } from "@adrian-zephyr-notes/contracts";

type AgentConversationMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type AgentConversationToolCallItem = {
  id: string;
  toolCallId: string;
  type: "toolCall";
};

type AgentConversationItem = AgentConversationMessage | AgentConversationToolCallItem;

type AgentLandingCapabilitySuggestion = {
  id: AdminAgentCapabilityId;
  title: string;
  description: string;
  prompt: string;
};

export type {
  AgentConversationItem,
  AgentConversationMessage,
  AgentConversationToolCallItem,
  AgentLandingCapabilitySuggestion,
};
