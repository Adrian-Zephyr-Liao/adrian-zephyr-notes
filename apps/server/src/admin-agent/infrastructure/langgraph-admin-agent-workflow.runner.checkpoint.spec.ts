import { beforeEach, describe, expect, it, vi } from "vitest";

const postgresMocks = vi.hoisted(() => {
  const poolInstances: Array<{ config: unknown; end: ReturnType<typeof vi.fn> }> = [];
  const saverInstances: Array<{
    options: unknown;
    pool: unknown;
    setup: ReturnType<typeof vi.fn>;
  }> = [];

  class Pool {
    readonly config: unknown;
    readonly end = vi.fn().mockResolvedValue(undefined);

    constructor(config: unknown) {
      this.config = config;
      poolInstances.push(this);
    }
  }

  class PostgresSaver {
    readonly setup = vi.fn().mockResolvedValue(undefined);

    constructor(pool: unknown, _serde: unknown, options: unknown) {
      saverInstances.push({
        options,
        pool,
        setup: this.setup,
      });
    }
  }

  return {
    Pool,
    PostgresSaver,
    poolInstances,
    saverInstances,
  };
});

vi.mock("pg", () => ({
  default: {
    Pool: postgresMocks.Pool,
  },
}));

vi.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: postgresMocks.PostgresSaver,
}));

describe("LangGraph admin agent checkpoint lifecycle", () => {
  beforeEach(() => {
    postgresMocks.poolInstances.length = 0;
    postgresMocks.saverInstances.length = 0;
  });

  it("requires DATABASE_URL when no test checkpointer is injected", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");

    expect(() => createLangGraphAdminAgentCheckpointHandle(createConfigService({}))).toThrow(
      "DATABASE_URL is required to start LangGraph admin agent workflows.",
    );
  });

  it("uses Postgres checkpoints without startup-time setup by default", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");
    const checkpoint = createLangGraphAdminAgentCheckpointHandle(
      createConfigService({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        LANGGRAPH_CHECKPOINT_SCHEMA: "agent_checkpoint",
      }),
    );

    expect(postgresMocks.poolInstances).toHaveLength(1);
    expect(postgresMocks.poolInstances[0]?.config).toEqual({
      connectionString: "postgresql://user:pass@localhost:5432/app",
    });
    expect(postgresMocks.saverInstances).toHaveLength(1);
    expect(postgresMocks.saverInstances[0]?.options).toEqual({
      schema: "agent_checkpoint",
    });

    await checkpoint.setup();
    expect(postgresMocks.saverInstances[0]?.setup).not.toHaveBeenCalled();

    await checkpoint.dispose();
    expect(postgresMocks.poolInstances[0]?.end).toHaveBeenCalledTimes(1);
  });

  it("defaults checkpoint schema to public and trims explicit schema values", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");

    createLangGraphAdminAgentCheckpointHandle(
      createConfigService({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    );
    createLangGraphAdminAgentCheckpointHandle(
      createConfigService({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        LANGGRAPH_CHECKPOINT_SCHEMA: " agent_checkpoint ",
      }),
    );

    expect(postgresMocks.saverInstances[0]?.options).toEqual({
      schema: "public",
    });
    expect(postgresMocks.saverInstances[1]?.options).toEqual({
      schema: "agent_checkpoint",
    });
  });

  it("rejects unsafe checkpoint schema names before opening database connections", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");

    expect(() =>
      createLangGraphAdminAgentCheckpointHandle(
        createConfigService({
          DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
          LANGGRAPH_CHECKPOINT_SCHEMA: "agent-checkpoint",
        }),
      ),
    ).toThrow(
      "LANGGRAPH_CHECKPOINT_SCHEMA must be a lowercase PostgreSQL identifier, for example public or agent_checkpoint.",
    );
    expect(() =>
      createLangGraphAdminAgentCheckpointHandle(
        createConfigService({
          DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
          LANGGRAPH_CHECKPOINT_SCHEMA: "AgentCheckpoint",
        }),
      ),
    ).toThrow(
      "LANGGRAPH_CHECKPOINT_SCHEMA must be a lowercase PostgreSQL identifier, for example public or agent_checkpoint.",
    );
    expect(postgresMocks.poolInstances).toHaveLength(0);
  });

  it("supports explicit startup-time checkpoint setup for disposable local environments", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");
    const checkpoint = createLangGraphAdminAgentCheckpointHandle(
      createConfigService({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        LANGGRAPH_CHECKPOINT_SETUP_ON_START: "true",
      }),
    );

    await checkpoint.setup();

    expect(postgresMocks.saverInstances[0]?.setup).toHaveBeenCalledTimes(1);
  });

  it("uses an injected checkpointer for tests without opening database connections", async () => {
    const { createLangGraphAdminAgentCheckpointHandle } =
      await import("./langgraph-admin-agent-checkpoint.manager.js");
    const injectedCheckpointer = { kind: "memory" };
    const checkpoint = createLangGraphAdminAgentCheckpointHandle(createConfigService({}), {
      checkpointer: injectedCheckpointer,
    });

    expect(checkpoint.checkpointer).toBe(injectedCheckpointer);
    expect(postgresMocks.poolInstances).toHaveLength(0);

    await checkpoint.setup();
    await checkpoint.dispose();
  });
});

function createConfigService(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key] ?? "";
    },
  } as never;
}
