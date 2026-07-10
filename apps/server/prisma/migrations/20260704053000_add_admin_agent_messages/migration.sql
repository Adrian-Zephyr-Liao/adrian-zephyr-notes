CREATE TYPE "AdminAgentChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

CREATE TABLE "admin_agent_conversation_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" TEXT NOT NULL,
    "role" "AdminAgentChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_agent_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_agent_conversation_messages_conversation_id_created_at_idx"
    ON "admin_agent_conversation_messages"("conversation_id", "created_at");

CREATE INDEX "admin_agent_conversation_messages_actor_user_id_created_at_idx"
    ON "admin_agent_conversation_messages"("actor_user_id", "created_at");

ALTER TABLE "admin_agent_conversation_messages"
    ADD CONSTRAINT "admin_agent_conversation_messages_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
