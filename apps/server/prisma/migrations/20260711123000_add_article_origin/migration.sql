CREATE TYPE "ArticleOrigin" AS ENUM ('ORIGINAL', 'REPOSTED');

ALTER TABLE "articles"
  ADD COLUMN "origin" "ArticleOrigin" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "source_name" TEXT,
  ADD COLUMN "source_author" TEXT,
  ADD COLUMN "source_url" TEXT;

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_origin_source_chk"
  CHECK (
    ("origin" = 'ORIGINAL' AND "source_name" IS NULL AND "source_author" IS NULL AND "source_url" IS NULL)
    OR
    (
      "origin" = 'REPOSTED'
      AND (
        "status" = 'DRAFT'
        OR (
          NULLIF(BTRIM("source_name"), '') IS NOT NULL
          AND NULLIF(BTRIM("source_url"), '') IS NOT NULL
        )
      )
    )
  );

CREATE INDEX "articles_origin_status_published_at_idx"
  ON "articles"("origin", "status", "published_at" DESC);

ALTER TABLE "admin_article_editor_drafts"
  ADD COLUMN "origin" "ArticleOrigin" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "source_name" TEXT,
  ADD COLUMN "source_author" TEXT,
  ADD COLUMN "source_url" TEXT;
