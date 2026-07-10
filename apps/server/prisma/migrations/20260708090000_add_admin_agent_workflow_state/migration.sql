ALTER TABLE "admin_agent_runs"
  ADD COLUMN "workflow_name" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "thread_id" TEXT,
  ADD COLUMN "parent_run_id" UUID,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "current_node" TEXT,
  ADD COLUMN "interruption" JSONB,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_resumed_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "admin_agent_runs_thread_id_key" ON "admin_agent_runs"("thread_id");
CREATE INDEX "admin_agent_runs_workflow_name_created_at_idx" ON "admin_agent_runs"("workflow_name", "created_at" DESC);
CREATE INDEX "admin_agent_runs_parent_run_id_created_at_idx" ON "admin_agent_runs"("parent_run_id", "created_at" DESC);

ALTER TABLE "admin_agent_runs"
  ADD CONSTRAINT "admin_agent_runs_parent_run_id_fkey"
  FOREIGN KEY ("parent_run_id") REFERENCES "admin_agent_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
