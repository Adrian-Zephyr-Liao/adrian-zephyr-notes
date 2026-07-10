type AdminAgentWorkflowEventType =
  | "CANCELLED"
  | "COMPLETED"
  | "CONTROLLED"
  | "FAILED"
  | "INTERRUPTED"
  | "NODE_STARTED"
  | "RUN_ATTEMPT_STARTED"
  | "RUN_CREATED"
  | "RUN_RESUMED";

type AdminAgentWorkflowEvent = {
  createdAt: Date;
  id: string;
  node: string | null;
  payload: Record<string, unknown> | null;
  runId: string;
  summary: string | null;
  type: AdminAgentWorkflowEventType;
};

export type { AdminAgentWorkflowEvent, AdminAgentWorkflowEventType };
