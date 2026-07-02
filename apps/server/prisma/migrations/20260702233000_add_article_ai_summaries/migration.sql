CREATE TYPE "ArticleAiSummaryStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

CREATE TABLE "article_ai_summaries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL,
  "summary" TEXT,
  "status" "ArticleAiSummaryStatus" NOT NULL DEFAULT 'PENDING',
  "content_hash" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "generated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "article_ai_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_ai_summaries_article_id_key"
  ON "article_ai_summaries"("article_id");

CREATE INDEX "article_ai_summaries_status_updated_at_idx"
  ON "article_ai_summaries"("status", "updated_at");

ALTER TABLE "article_ai_summaries"
  ADD CONSTRAINT "article_ai_summaries_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
