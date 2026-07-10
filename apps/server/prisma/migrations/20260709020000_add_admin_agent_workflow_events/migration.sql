CREATE TYPE "AdminAgentWorkflowEventType" AS ENUM (
  'RUN_CREATED',
  'RUN_ATTEMPT_STARTED',
  'RUN_RESUMED',
  'NODE_STARTED',
  'INTERRUPTED',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "admin_agent_workflow_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "type" "AdminAgentWorkflowEventType" NOT NULL,
  "node" TEXT,
  "summary" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_agent_workflow_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_agent_workflow_events_run_id_created_at_idx"
  ON "admin_agent_workflow_events"("run_id", "created_at");

CREATE INDEX "admin_agent_workflow_events_type_created_at_idx"
  ON "admin_agent_workflow_events"("type", "created_at" DESC);

ALTER TABLE "admin_agent_workflow_events"
  ADD CONSTRAINT "admin_agent_workflow_events_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "admin_agent_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
