ALTER TABLE "article_comments"
  ADD COLUMN "like_count" integer NOT NULL DEFAULT 0;

CREATE TABLE "article_comment_likes" (
  "comment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id")
);

CREATE INDEX "article_comment_likes_user_id_idx"
  ON "article_comment_likes"("user_id");

ALTER TABLE "article_comment_likes"
  ADD CONSTRAINT "article_comment_likes_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "article_comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_comment_likes"
  ADD CONSTRAINT "article_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
