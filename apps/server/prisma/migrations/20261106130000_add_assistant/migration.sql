BEGIN;
CREATE TYPE "AssistantTurnStatus" AS ENUM ('RUNNING', 'CANCELLING', 'COMPLETED', 'CANCELLED', 'FAILED', 'INTERRUPTED');
CREATE TYPE "AssistantActionStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');
ALTER TABLE "article_comments" ADD COLUMN "moderation_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "assistant_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "owner_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "assistant_conversations_owner_user_id_created_at_idx" ON "assistant_conversations"("owner_user_id", "created_at" DESC);
CREATE TABLE "assistant_turns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "conversation_id" UUID NOT NULL, "request_id" VARCHAR(200) NOT NULL,
  "input_hash" TEXT NOT NULL, "input" TEXT NOT NULL, "status" "AssistantTurnStatus" NOT NULL DEFAULT 'RUNNING',
  "transcript" JSONB NOT NULL DEFAULT '{"version":1,"messages":[]}', "error_code" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "assistant_turns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "assistant_turns_conversation_id_request_id_key" ON "assistant_turns"("conversation_id", "request_id");
CREATE UNIQUE INDEX "assistant_turns_id_conversation_id_key" ON "assistant_turns"("id", "conversation_id");
CREATE INDEX "assistant_turns_conversation_id_created_at_id_idx" ON "assistant_turns"("conversation_id", "created_at", "id");
CREATE UNIQUE INDEX "assistant_turns_one_active_per_conversation" ON "assistant_turns"("conversation_id") WHERE "status" IN ('RUNNING', 'CANCELLING');
CREATE TABLE "assistant_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "conversation_id" UUID NOT NULL, "turn_id" UUID NOT NULL,
  "tool_call_id" VARCHAR(500) NOT NULL, "comment_id" UUID NOT NULL,
  "current_status" "ArticleCommentStatus" NOT NULL, "target_status" "ArticleCommentStatus" NOT NULL,
  "target_version" INTEGER NOT NULL, "preview" JSONB NOT NULL,
  "status" "AssistantActionStatus" NOT NULL DEFAULT 'PENDING',
  "decided_by_user_id" UUID, "decided_at" TIMESTAMPTZ(6), "receipt" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistant_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_actions_turn_id_conversation_id_fkey" FOREIGN KEY ("turn_id", "conversation_id") REFERENCES "assistant_turns"("id", "conversation_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "assistant_actions_turn_id_tool_call_id_key" ON "assistant_actions"("turn_id", "tool_call_id");
CREATE INDEX "assistant_actions_conversation_id_created_at_idx" ON "assistant_actions"("conversation_id", "created_at");
COMMIT;
