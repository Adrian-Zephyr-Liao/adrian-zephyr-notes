CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "article_categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_tags" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "article_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "articles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "markdown" text NOT NULL,
  "status" "ArticleStatus" NOT NULL,
  "category_id" uuid,
  "cover_image_url" text,
  "word_count" integer NOT NULL,
  "reading_minutes" integer NOT NULL,
  "published_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_tag_links" (
  "article_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  CONSTRAINT "article_tag_links_pkey" PRIMARY KEY ("article_id", "tag_id")
);

CREATE TABLE "article_revisions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "article_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "markdown" text NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_categories_slug_key" ON "article_categories"("slug");
CREATE UNIQUE INDEX "article_categories_name_key" ON "article_categories"("name");
CREATE UNIQUE INDEX "article_tags_slug_key" ON "article_tags"("slug");
CREATE UNIQUE INDEX "article_tags_name_key" ON "article_tags"("name");
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at" DESC);

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "article_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "article_tag_links"
  ADD CONSTRAINT "article_tag_links_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_tag_links"
  ADD CONSTRAINT "article_tag_links_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "article_tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_revisions"
  ADD CONSTRAINT "article_revisions_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
