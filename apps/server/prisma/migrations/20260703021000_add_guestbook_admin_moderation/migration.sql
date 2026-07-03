ALTER TYPE "GuestbookMessageStatus" ADD VALUE IF NOT EXISTS 'DELETED';

ALTER TABLE "guestbook_messages"
  ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinned_at" TIMESTAMPTZ(6);

DROP INDEX IF EXISTS "guestbook_messages_status_created_at_idx";

CREATE INDEX "guestbook_messages_status_is_pinned_pinned_at_created_at_idx"
  ON "guestbook_messages"("status", "is_pinned", "pinned_at" DESC, "created_at" DESC);
