import type { AdminAgentAutomationPolicy } from "./admin-agent-automation-policy";

type AdminAgentAutomationPolicyRepository = {
  getPolicy(): Promise<AdminAgentAutomationPolicy>;
};

const ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY = Symbol("ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY");

export { ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY };
export type { AdminAgentAutomationPolicyRepository };
