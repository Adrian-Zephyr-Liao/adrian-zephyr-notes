import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    __dirname,
    "../../../prisma/migrations/20260709223000_add_langgraph_checkpoint_tables/migration.sql",
  ),
  "utf8",
);

describe("LangGraph checkpoint migration", () => {
  it("commits the default Postgres checkpoint schema to Prisma migrations", () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public".checkpoint_migrations');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public".checkpoints');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public".checkpoint_blobs');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "public".checkpoint_writes');
    expect(migrationSql).toContain("PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)");
    expect(migrationSql).toContain("PRIMARY KEY (thread_id, checkpoint_ns, channel, version)");
    expect(migrationSql).toContain(
      "PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)",
    );
    expect(migrationSql).toContain("ALTER COLUMN blob DROP NOT NULL");
    expect(migrationSql).toContain(
      'INSERT INTO "public".checkpoint_migrations (v)\nVALUES (0), (1), (2), (3), (4)',
    );
  });
});
