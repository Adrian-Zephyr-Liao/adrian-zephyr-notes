import {
  getAdminAgentHome,
  listAdminAgentConversationMessages,
  listAdminAgentTasks,
} from "../../lib/admin-api";

type AgentWorkbenchClient = {
  listConversationMessages: typeof listAdminAgentConversationMessages;
  listAgentTasks: typeof listAdminAgentTasks;
  loadHome: typeof getAdminAgentHome;
};

const agentWorkbenchClient: AgentWorkbenchClient = {
  listConversationMessages: listAdminAgentConversationMessages,
  listAgentTasks: listAdminAgentTasks,
  loadHome: getAdminAgentHome,
};

function useAgentWorkbenchClient(): AgentWorkbenchClient {
  return agentWorkbenchClient;
}

export { useAgentWorkbenchClient };
export type { AgentWorkbenchClient };
