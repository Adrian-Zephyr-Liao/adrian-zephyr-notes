import { ConfigService } from "@nestjs/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

type LangGraphAdminAgentCheckpointOptions = {
  checkpointer?: unknown;
};

type LangGraphAdminAgentCheckpointHandle = {
  checkpointer: unknown;
  dispose(): Promise<void>;
  setup(): Promise<void>;
};

const defaultLangGraphCheckpointSchema = "public";
const postgresIdentifierPattern = /^[a-z_][a-z0-9_]*$/;

function createLangGraphAdminAgentCheckpointHandle(
  configService: ConfigService,
  options: LangGraphAdminAgentCheckpointOptions = {},
): LangGraphAdminAgentCheckpointHandle {
  if (options.checkpointer) {
    return {
      checkpointer: options.checkpointer,
      async dispose() {},
      async setup() {},
    };
  }

  const databaseUrl = configService.get<string>("DATABASE_URL");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to start LangGraph admin agent workflows.");
  }

  const checkpointSchema = resolveLangGraphCheckpointSchema(
    configService.get<string>("LANGGRAPH_CHECKPOINT_SCHEMA"),
  );
  const setupOnStart =
    configService.get<string>("LANGGRAPH_CHECKPOINT_SETUP_ON_START")?.trim().toLowerCase() ===
    "true";
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const checkpointer = new PostgresSaver(pool, undefined, {
    schema: checkpointSchema,
  });

  return {
    checkpointer,
    async dispose() {
      await pool.end();
    },
    async setup() {
      if (setupOnStart) {
        await checkpointer.setup();
      }
    },
  };
}

function resolveLangGraphCheckpointSchema(value: string | null | undefined) {
  const schema = value?.trim() || defaultLangGraphCheckpointSchema;

  if (!postgresIdentifierPattern.test(schema)) {
    throw new Error(
      "LANGGRAPH_CHECKPOINT_SCHEMA must be a lowercase PostgreSQL identifier, for example public or agent_checkpoint.",
    );
  }

  return schema;
}

export { createLangGraphAdminAgentCheckpointHandle, resolveLangGraphCheckpointSchema };
export type { LangGraphAdminAgentCheckpointHandle, LangGraphAdminAgentCheckpointOptions };
