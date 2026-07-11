DROP INDEX "article_tags_name_key";

CREATE UNIQUE INDEX "article_tags_name_ci_key"
  ON "article_tags" (LOWER(BTRIM("name")));

ALTER TABLE "article_tag_links"
  DROP CONSTRAINT "article_tag_links_tag_id_fkey";

ALTER TABLE "article_tag_links"
  ADD CONSTRAINT "article_tag_links_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "article_tags"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
