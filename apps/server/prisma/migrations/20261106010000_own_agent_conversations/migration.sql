CREATE TABLE "admin_agent_conversations" (
  "id" TEXT NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_agent_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_agent_conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "admin_agent_conversations_owner_user_id_created_at_idx" ON "admin_agent_conversations"("owner_user_id", "created_at");
-- Preserve existing ownership from the earliest authenticated message in each conversation.
INSERT INTO "admin_agent_conversations" ("id", "owner_user_id", "created_at")
SELECT DISTINCT ON ("conversation_id") "conversation_id", "actor_user_id", "created_at"
FROM "admin_agent_messages"
WHERE "actor_user_id" IS NOT NULL
ORDER BY "conversation_id", "created_at", "id";
