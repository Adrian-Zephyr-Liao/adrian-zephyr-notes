CREATE TYPE "OAuthDeviceStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CONSUMED');

CREATE TABLE "oauth_device_authorizations" (
  "id" UUID NOT NULL,
  "device_code_hash" TEXT NOT NULL,
  "user_code_hash" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" "OAuthDeviceStatus" NOT NULL DEFAULT 'PENDING',
  "user_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "interval_seconds" INTEGER NOT NULL DEFAULT 5,
  "next_poll_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_device_authorizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_device_authorizations_interval_check" CHECK ("interval_seconds" >= 5)
);

CREATE TABLE "oauth_access_tokens" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "client_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_device_authorizations_device_code_hash_key" ON "oauth_device_authorizations"("device_code_hash");
CREATE UNIQUE INDEX "oauth_device_authorizations_user_code_hash_key" ON "oauth_device_authorizations"("user_code_hash");
CREATE INDEX "oauth_device_authorizations_expires_at_idx" ON "oauth_device_authorizations"("expires_at");
CREATE INDEX "oauth_device_authorizations_user_id_idx" ON "oauth_device_authorizations"("user_id");
CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");
CREATE INDEX "oauth_access_tokens_expires_at_idx" ON "oauth_access_tokens"("expires_at");

ALTER TABLE "oauth_device_authorizations" ADD CONSTRAINT "oauth_device_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
