ALTER TABLE "admin_agent_runs"
  ADD COLUMN "parent_run_relation" TEXT;

CREATE INDEX "admin_agent_runs_parent_run_relation_created_at_idx"
  ON "admin_agent_runs"("parent_run_relation", "created_at" DESC);
