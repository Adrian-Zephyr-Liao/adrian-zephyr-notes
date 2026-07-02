CREATE TYPE "GuestbookMessageStatus" AS ENUM ('VISIBLE', 'HIDDEN');

CREATE TABLE "guestbook_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "author_user_id" UUID,
  "guest_nickname" TEXT,
  "guest_fingerprint" TEXT,
  "body" TEXT NOT NULL,
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "status" "GuestbookMessageStatus" NOT NULL DEFAULT 'VISIBLE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "guestbook_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guestbook_message_likes" (
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "guestbook_message_likes_pkey" PRIMARY KEY ("message_id", "user_id")
);

CREATE INDEX "guestbook_messages_status_created_at_idx"
  ON "guestbook_messages"("status", "created_at" DESC);

CREATE INDEX "guestbook_messages_author_user_id_idx"
  ON "guestbook_messages"("author_user_id");

CREATE INDEX "guestbook_messages_guest_fingerprint_created_at_idx"
  ON "guestbook_messages"("guest_fingerprint", "created_at");

CREATE INDEX "guestbook_message_likes_user_id_idx"
  ON "guestbook_message_likes"("user_id");

ALTER TABLE "guestbook_messages"
  ADD CONSTRAINT "guestbook_messages_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guestbook_message_likes"
  ADD CONSTRAINT "guestbook_message_likes_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "guestbook_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guestbook_message_likes"
  ADD CONSTRAINT "guestbook_message_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
