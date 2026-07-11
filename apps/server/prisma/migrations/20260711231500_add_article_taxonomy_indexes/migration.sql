CREATE INDEX "articles_category_id_idx" ON "articles"("category_id");

CREATE INDEX "article_tag_links_tag_id_idx" ON "article_tag_links"("tag_id");

CREATE INDEX "admin_article_editor_drafts_category_slug_idx"
  ON "admin_article_editor_drafts"("category_slug");

CREATE INDEX "admin_article_editor_drafts_tag_slugs_idx"
  ON "admin_article_editor_drafts" USING GIN("tag_slugs");
