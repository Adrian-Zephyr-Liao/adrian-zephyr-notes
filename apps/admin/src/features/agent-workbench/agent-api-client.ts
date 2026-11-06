import {
  getAdminAgentHome,
  listAdminAgentConversationMessages,
  listAdminAgentTasks,
  stopAdminAgentConversation,
} from "../../lib/admin-api";

type AgentWorkbenchClient = {
  listConversationMessages: typeof listAdminAgentConversationMessages;
  listAgentTasks: typeof listAdminAgentTasks;
  loadHome: typeof getAdminAgentHome;
  stopConversation: typeof stopAdminAgentConversation;
};

const agentWorkbenchClient: AgentWorkbenchClient = {
  listConversationMessages: listAdminAgentConversationMessages,
  listAgentTasks: listAdminAgentTasks,
  loadHome: getAdminAgentHome,
  stopConversation: stopAdminAgentConversation,
};

function useAgentWorkbenchClient(): AgentWorkbenchClient {
  return agentWorkbenchClient;
}

export { useAgentWorkbenchClient };
export type { AgentWorkbenchClient };
