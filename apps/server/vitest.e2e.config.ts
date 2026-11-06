import { defineConfig } from "vitest/config";

const databaseUrl = process.env.ASSISTANT_TEST_DATABASE_URL ?? "";

export default defineConfig({
  test: {
    include: ["test/**/*.ts"],
    // Freeze explicit test authorization before AppModule can load the active .env.
    env: { ASSISTANT_TEST_DATABASE_URL: databaseUrl, DATABASE_URL: databaseUrl },
    // Assistant startup reconciliation and lock tests share the disposable database.
    fileParallelism: false,
  },
});
