ALTER TYPE "AdminAgentMessageRole" ADD VALUE IF NOT EXISTS 'REASONING';

ALTER TABLE "admin_agent_messages"
  ADD COLUMN "duration_ms" INTEGER;

ALTER TABLE "admin_agent_messages"
  ADD CONSTRAINT "admin_agent_messages_duration_ms_check"
  CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0);
