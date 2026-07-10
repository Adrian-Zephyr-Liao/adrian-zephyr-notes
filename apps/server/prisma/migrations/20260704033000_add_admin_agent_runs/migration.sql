CREATE TYPE "AdminAgentRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "AdminAgentFindingStatus" AS ENUM (
  'PENDING',
  'REJECTED',
  'EXECUTED',
  'FAILED'
);

CREATE TYPE "AdminAgentFindingTargetType" AS ENUM ('ARTICLE_COMMENT');
CREATE TYPE "AdminAgentFindingCategory" AS ENUM ('SPAM', 'HARASSMENT', 'ABUSE', 'SENSITIVE', 'OTHER');
CREATE TYPE "AdminAgentFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AdminAgentProposedAction" AS ENUM ('HIDE_COMMENT', 'NO_ACTION');

CREATE TABLE "admin_agent_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "status" "AdminAgentRunStatus" NOT NULL DEFAULT 'PENDING',
  "started_by_user_id" UUID,
  "input" JSONB NOT NULL,
  "summary" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "admin_agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_agent_findings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "target_type" "AdminAgentFindingTargetType" NOT NULL,
  "target_id" UUID NOT NULL,
  "category" "AdminAgentFindingCategory" NOT NULL,
  "severity" "AdminAgentFindingSeverity" NOT NULL,
  "confidence" DECIMAL(4, 3) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "proposed_action" "AdminAgentProposedAction" NOT NULL,
  "status" "AdminAgentFindingStatus" NOT NULL DEFAULT 'PENDING',
  "executed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "admin_agent_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_agent_runs_status_created_at_idx"
  ON "admin_agent_runs"("status", "created_at" DESC);

CREATE INDEX "admin_agent_runs_type_created_at_idx"
  ON "admin_agent_runs"("type", "created_at" DESC);

CREATE INDEX "admin_agent_runs_started_by_user_id_created_at_idx"
  ON "admin_agent_runs"("started_by_user_id", "created_at" DESC);

CREATE INDEX "admin_agent_findings_status_created_at_idx"
  ON "admin_agent_findings"("status", "created_at" DESC);

CREATE INDEX "admin_agent_findings_run_id_idx"
  ON "admin_agent_findings"("run_id");

CREATE INDEX "admin_agent_findings_target_type_target_id_status_idx"
  ON "admin_agent_findings"("target_type", "target_id", "status");

CREATE UNIQUE INDEX "admin_agent_findings_pending_target_unique_idx"
  ON "admin_agent_findings"("target_type", "target_id")
  WHERE "status" = 'PENDING';

ALTER TABLE "admin_agent_runs"
  ADD CONSTRAINT "admin_agent_runs_started_by_user_id_fkey"
  FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_agent_findings"
  ADD CONSTRAINT "admin_agent_findings_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "admin_agent_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_agent_findings"
  ADD CONSTRAINT "admin_agent_findings_target_id_fkey"
  FOREIGN KEY ("target_id") REFERENCES "article_comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
