import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import type { AbstractAgent } from "@ag-ui/client";
import type { CopilotKitContextValue } from "@copilotkit/react-core/v2";
import type { AdminAgentInteractionEvent } from "@adrian-zephyr-notes/contracts";
import { useMemo } from "react";
import {
  getAdminAgentHome,
  listAdminAgentConversationMessages,
  listAdminAgentTasks,
} from "../../lib/admin-api";
import { streamCopilotKitAdminAgentRun } from "./agent-copilotkit-client";
import type { AgentConversationMessage } from "./agent-workbench-types";

const adminAgentId = "admin-agent";

type AgentWorkbenchClient = {
  listConversationMessages: typeof listAdminAgentConversationMessages;
  listAgentTasks: typeof listAdminAgentTasks;
  loadHome: typeof getAdminAgentHome;
  streamChatMessage: (
    input: AgentWorkbenchChatInput,
    handlers: AgentWorkbenchStreamHandlers,
  ) => Promise<void>;
};

type AgentWorkbenchStreamHandlers = {
  onEvent: (event: AdminAgentInteractionEvent) => void;
};

type AgentWorkbenchChatInput = {
  conversationId: string;
  message: string;
  recentMessages: AgentConversationMessage[];
};

function useAgentWorkbenchClient(): AgentWorkbenchClient {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({
    agentId: adminAgentId,
    updates: [],
  });

  return useMemo(() => createAgentWorkbenchClient(agent, copilotkit), [agent, copilotkit]);
}

function createAgentWorkbenchClient(
  agent: AbstractAgent,
  copilotkit: CopilotKitContextValue["copilotkit"],
): AgentWorkbenchClient {
  return {
    listConversationMessages: listAdminAgentConversationMessages,
    listAgentTasks: listAdminAgentTasks,
    loadHome: getAdminAgentHome,
    streamChatMessage(input, handlers) {
      return streamCopilotKitAdminAgentRun(copilotkit, agent, input, handlers);
    },
  };
}

export { createAgentWorkbenchClient, useAgentWorkbenchClient };
export type { AgentWorkbenchChatInput, AgentWorkbenchClient, AgentWorkbenchStreamHandlers };
