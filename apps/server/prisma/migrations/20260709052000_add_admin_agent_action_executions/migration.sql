CREATE TYPE "AdminAgentWorkflowActionExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "admin_agent_workflow_action_executions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "approval_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "AdminAgentWorkflowActionExecutionStatus" NOT NULL DEFAULT 'RUNNING',
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "admin_agent_workflow_action_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_agent_workflow_action_executions_run_id_approval_id_key"
  ON "admin_agent_workflow_action_executions"("run_id", "approval_id");

CREATE INDEX "admin_agent_workflow_action_executions_run_id_created_at_idx"
  ON "admin_agent_workflow_action_executions"("run_id", "created_at");

CREATE INDEX "admin_agent_workflow_action_executions_status_updated_at_idx"
  ON "admin_agent_workflow_action_executions"("status", "updated_at");

ALTER TABLE "admin_agent_workflow_action_executions"
  ADD CONSTRAINT "admin_agent_workflow_action_executions_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "admin_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
