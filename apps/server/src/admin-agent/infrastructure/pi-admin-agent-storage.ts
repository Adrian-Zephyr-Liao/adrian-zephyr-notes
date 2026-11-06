import { BACKGROUND_CONTEXT, openNodeSqliteStorage } from "./pi-admin-agent-runtime.mjs";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

/** One process owns each durable store, including across application replicas. */
export async function openPiAdminAgentStorage(config: ConfigService, key: string) {
  const directory = resolve(config.get<string>("PI_AGENT_STORAGE_DIR") || "./.data/pi");
  const name = createHash("sha256").update(key).digest("hex");
  const databaseUrl = config.get<string>("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required to own Pi agent storage.");
  const owner = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  });
  const ownership = new AbortController();
  let closing: Promise<void> | undefined;
  let storage: Awaited<ReturnType<typeof openNodeSqliteStorage>> | undefined;
  const close = () => {
    closing ??= (async () => {
      try {
        await storage?.close(BACKGROUND_CONTEXT);
      } finally {
        await owner.end();
      }
    })();
    return closing;
  };
  const lost = (error?: Error) => {
    if (closing) return;
    ownership.abort(error ?? new Error("Pi agent storage ownership connection ended."));
    void close().catch(() => undefined);
  };
  owner.on("error", lost);
  owner.on("end", () => lost());
  try {
    await owner.connect();
    const result = await owner.query<{ owned: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS owned",
      [`az-notes:pi:${name}`],
    );
    if (!result.rows[0]?.owned)
      throw new Error("Pi agent storage is already owned by another process.");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    storage = await openNodeSqliteStorage(resolve(directory, `${name}.sqlite`));
    if (ownership.signal.aborted) {
      await storage.close(BACKGROUND_CONTEXT);
      throw ownership.signal.reason;
    }
    return {
      storage,
      ownershipLost: ownership.signal,
      close,
    };
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
}
