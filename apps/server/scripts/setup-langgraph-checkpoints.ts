import "dotenv/config";

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";
import { resolveLangGraphCheckpointSchema } from "../src/admin-agent/infrastructure/langgraph-admin-agent-checkpoint.manager.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to set up LangGraph checkpoint tables.");
  }

  const schema = resolveLangGraphCheckpointSchema(process.env.LANGGRAPH_CHECKPOINT_SCHEMA);
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const checkpointer = new PostgresSaver(pool, undefined, { schema });
    await checkpointer.setup();
    console.log(`LangGraph checkpoint tables are ready in schema "${schema}".`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown setup error.";
  console.error(message);
  process.exitCode = 1;
});
