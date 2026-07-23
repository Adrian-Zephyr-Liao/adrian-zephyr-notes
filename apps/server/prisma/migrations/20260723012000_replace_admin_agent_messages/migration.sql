DROP TABLE IF EXISTS "admin_agent_conversation_messages";
DROP TABLE IF EXISTS "admin_agent_messages";
DROP TYPE IF EXISTS "AdminAgentChatMessageRole";
DROP TYPE IF EXISTS "AdminAgentMessageRole";

CREATE TYPE "AdminAgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'ACTIVITY');

CREATE TABLE "admin_agent_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" "AdminAgentMessageRole" NOT NULL,
  "message" JSONB NOT NULL,
  "actor_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "admin_agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_agent_messages_conversation_id_created_at_idx"
  ON "admin_agent_messages"("conversation_id", "created_at");

CREATE INDEX "admin_agent_messages_conversation_id_role_created_at_idx"
  ON "admin_agent_messages"("conversation_id", "role", "created_at");

CREATE INDEX "admin_agent_messages_actor_user_id_created_at_idx"
  ON "admin_agent_messages"("actor_user_id", "created_at");

ALTER TABLE "admin_agent_messages"
  ADD CONSTRAINT "admin_agent_messages_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
