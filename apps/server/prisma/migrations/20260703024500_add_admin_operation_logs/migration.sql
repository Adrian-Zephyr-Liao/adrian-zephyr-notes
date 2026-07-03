CREATE TABLE "admin_operation_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "actor_login" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_operation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_operation_logs_created_at_idx" ON "admin_operation_logs"("created_at" DESC);
CREATE INDEX "admin_operation_logs_actor_login_created_at_idx" ON "admin_operation_logs"("actor_login", "created_at" DESC);
CREATE INDEX "admin_operation_logs_action_created_at_idx" ON "admin_operation_logs"("action", "created_at" DESC);
CREATE INDEX "admin_operation_logs_resource_type_resource_id_idx" ON "admin_operation_logs"("resource_type", "resource_id");

ALTER TABLE "admin_operation_logs" ADD CONSTRAINT "admin_operation_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
