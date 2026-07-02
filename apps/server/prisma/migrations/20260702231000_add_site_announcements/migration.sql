CREATE TABLE "site_announcements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "icon_class_name" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "output" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "site_announcements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_announcements_key_key"
  ON "site_announcements"("key");

CREATE INDEX "site_announcements_is_enabled_sort_order_idx"
  ON "site_announcements"("is_enabled", "sort_order");
