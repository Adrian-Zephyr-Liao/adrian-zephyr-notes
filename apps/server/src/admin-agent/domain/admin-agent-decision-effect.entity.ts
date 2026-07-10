type AdminAgentDecisionEffectType =
  | "COMMENT_STATUS_AUDIT"
  | "FINDING_DECISION_AUDIT"
  | "RUN_COMPLETION";

type AdminAgentDecisionEffectStatus = "FAILED" | "PENDING" | "SUCCEEDED";

type AdminAgentDecisionEffect = {
  attempts: number;
  createdAt: Date;
  effectKey: string;
  errorMessage: string | null;
  findingId: string | null;
  id: string;
  payload: Record<string, unknown>;
  runId: string;
  status: AdminAgentDecisionEffectStatus;
  type: AdminAgentDecisionEffectType;
  updatedAt: Date;
};

type EnsureAdminAgentDecisionEffectInput = {
  effectKey: string;
  findingId?: string | null;
  payload: Record<string, unknown>;
  runId: string;
  type: AdminAgentDecisionEffectType;
};

export type {
  AdminAgentDecisionEffect,
  AdminAgentDecisionEffectStatus,
  AdminAgentDecisionEffectType,
  EnsureAdminAgentDecisionEffectInput,
};
