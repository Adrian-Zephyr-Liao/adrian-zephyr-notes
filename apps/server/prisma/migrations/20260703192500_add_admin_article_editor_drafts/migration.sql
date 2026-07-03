CREATE TABLE "admin_article_editor_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "article_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "category_slug" TEXT,
  "tag_slugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cover_image_url" TEXT,
  "base_article_updated_at" TIMESTAMPTZ(6),
  "client_saved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_article_editor_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_article_editor_drafts_owner_user_id_scope_key" ON "admin_article_editor_drafts"("owner_user_id", "scope");
CREATE INDEX "admin_article_editor_drafts_owner_user_id_updated_at_idx" ON "admin_article_editor_drafts"("owner_user_id", "updated_at" DESC);
CREATE INDEX "admin_article_editor_drafts_article_id_idx" ON "admin_article_editor_drafts"("article_id");

ALTER TABLE "admin_article_editor_drafts" ADD CONSTRAINT "admin_article_editor_drafts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_article_editor_drafts" ADD CONSTRAINT "admin_article_editor_drafts_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
