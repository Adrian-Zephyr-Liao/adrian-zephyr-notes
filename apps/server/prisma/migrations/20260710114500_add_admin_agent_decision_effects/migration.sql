CREATE TYPE "AdminAgentDecisionEffectType" AS ENUM (
  'FINDING_DECISION_AUDIT',
  'COMMENT_STATUS_AUDIT',
  'RUN_COMPLETION'
);

CREATE TYPE "AdminAgentDecisionEffectStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "admin_agent_decision_effects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "finding_id" UUID,
  "effect_key" TEXT NOT NULL,
  "type" "AdminAgentDecisionEffectType" NOT NULL,
  "status" "AdminAgentDecisionEffectStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "admin_agent_decision_effects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_agent_decision_effects_effect_key_key"
  ON "admin_agent_decision_effects"("effect_key");

CREATE INDEX "admin_agent_decision_effects_run_id_status_created_at_idx"
  ON "admin_agent_decision_effects"("run_id", "status", "created_at");

CREATE INDEX "admin_agent_decision_effects_finding_id_status_idx"
  ON "admin_agent_decision_effects"("finding_id", "status");

CREATE INDEX "admin_agent_decision_effects_type_status_updated_at_idx"
  ON "admin_agent_decision_effects"("type", "status", "updated_at");

ALTER TABLE "admin_agent_decision_effects"
  ADD CONSTRAINT "admin_agent_decision_effects_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "admin_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_agent_decision_effects"
  ADD CONSTRAINT "admin_agent_decision_effects_finding_id_fkey"
  FOREIGN KEY ("finding_id") REFERENCES "admin_agent_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
