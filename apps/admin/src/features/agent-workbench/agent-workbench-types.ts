import type { AdminAgentCapabilityId } from "@adrian-zephyr-notes/contracts";

type AgentLandingCapabilitySuggestion = {
  id: AdminAgentCapabilityId;
  title: string;
  description: string;
  prompt: string;
};

export type { AgentLandingCapabilitySuggestion };
