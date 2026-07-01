ALTER TABLE "article_comments"
  ADD COLUMN "parent_comment_id" uuid;

CREATE INDEX "article_comments_article_id_parent_comment_id_status_created_at_idx"
  ON "article_comments"("article_id", "parent_comment_id", "status", "created_at");

CREATE INDEX "article_comments_parent_comment_id_idx"
  ON "article_comments"("parent_comment_id");

ALTER TABLE "article_comments"
  ADD CONSTRAINT "article_comments_parent_comment_id_fkey"
  FOREIGN KEY ("parent_comment_id") REFERENCES "article_comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
