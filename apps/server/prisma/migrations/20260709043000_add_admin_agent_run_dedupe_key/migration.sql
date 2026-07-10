ALTER TABLE "admin_agent_runs" ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "admin_agent_runs_dedupe_key_key" ON "admin_agent_runs"("dedupe_key");
