CREATE TYPE "ArticleCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN');

CREATE TABLE "users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "github_id" text NOT NULL,
  "login" text NOT NULL,
  "name" text,
  "email" text,
  "avatar_url" text,
  "profile_url" text NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz(6) NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "article_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "body" text NOT NULL,
  "status" "ArticleCommentStatus" NOT NULL DEFAULT 'VISIBLE',
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL,
  CONSTRAINT "article_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
CREATE INDEX "article_comments_article_id_status_created_at_idx" ON "article_comments"("article_id", "status", "created_at");
CREATE INDEX "article_comments_author_id_idx" ON "article_comments"("author_id");

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_comments"
  ADD CONSTRAINT "article_comments_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_comments"
  ADD CONSTRAINT "article_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
