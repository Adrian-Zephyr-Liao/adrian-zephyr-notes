import type { ConfigService } from "@nestjs/config";
import pg from "pg";

type LegacyWorkflowImport = {
  runId: string;
  next: string[];
  state: Record<string, unknown>;
};

type LegacyImportQuery = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

const workflowNodes: Record<string, readonly string[]> = {
  COMMENT_MODERATION_ANALYSIS: [
    "load_comments",
    "analyze_comments",
    "persist_findings",
    "human_approval",
    "apply_approval",
    "complete",
  ],
  ARTICLE_ASSISTANCE: [
    "load_articles",
    "analyze_articles",
    "request_article_approval",
    "complete_article_assistance",
  ],
  AUDIT_REVIEW: [
    "load_audit_logs",
    "analyze_audit_logs",
    "request_audit_approval",
    "complete_audit_review",
  ],
  SITE_CONFIG_REVIEW: [
    "load_site_config",
    "analyze_site_config",
    "request_site_config_approval",
    "complete_site_config_review",
  ],
  MULTI_TASK_ORCHESTRATION: [
    "plan_multi_task",
    "request_multi_task_approval",
    "run_child_tasks",
    "complete_multi_task",
  ],
};

const businessChannels = new Set([
  "actionResult",
  "approval",
  "article",
  "articles",
  "childResults",
  "comments",
  "findings",
  "input",
  "logs",
  "output",
  "plan",
  "runId",
  "scope",
  "siteConfig",
  "startedByUserId",
  "summary",
]);

/** Read a consistent legacy snapshot without executing graph code or changing its history. */
async function loadLegacyWorkflowImports(
  config: ConfigService,
  injectedQuery?: LegacyImportQuery,
  importedRunIds: readonly string[] = [],
): Promise<LegacyWorkflowImport[]> {
  const databaseUrl = config.get<string>("DATABASE_URL")?.trim();
  if (!databaseUrl && !injectedQuery) return [];
  const schema = config.get<string>("PI_AGENT_LEGACY_CHECKPOINT_SCHEMA")?.trim() || "public";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error("PI_AGENT_LEGACY_CHECKPOINT_SCHEMA must be a lowercase PostgreSQL identifier.");
  }
  const pool = injectedQuery ? null : new pg.Pool({ connectionString: databaseUrl });
  const client = pool ? await pool.connect() : null;
  const query: LegacyImportQuery = injectedQuery ?? ((sql, values) => client!.query(sql, values));
  try {
    await query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: runs } = await query(
      `SELECT id, workflow_name, thread_id, status, input, interruption, started_by_user_id
       FROM admin_agent_runs
       WHERE status IN ('PENDING', 'RUNNING', 'WAITING_FOR_APPROVAL')
         AND COALESCE(metadata ->> 'engine', '') <> 'pi'
         AND NOT (id::text = ANY($1::text[]))
       ORDER BY created_at, id`,
      [[...importedRunIds]],
    );
    const imports: LegacyWorkflowImport[] = [];
    for (const run of runs) {
      const runId = requiredString(run.id, "run id");
      const workflowName = requiredString(run.workflow_name, "workflow name");
      const nodes = workflowNodes[workflowName];
      if (!nodes) throw new Error(`Cannot import unsupported Agent workflow ${workflowName}.`);
      const { rows: checkpoints } = await query(
        `SELECT checkpoint_id, checkpoint FROM "${schema}".checkpoints
         WHERE thread_id = $1 AND checkpoint_ns = '' ORDER BY checkpoint_id DESC LIMIT 1`,
        [run.thread_id ?? run.id],
      );
      const saved = checkpoints[0];
      if (!saved) {
        if (run.status !== "PENDING") {
          throw new Error(
            `Legacy Agent run ${runId} has no checkpoint; restore its checkpoint backup before switching engines.`,
          );
        }
        const requestedInput = record(run.input, "run input");
        imports.push({
          runId,
          next: [nodes[0]],
          state: {
            input: record(requestedInput.workflowInput ?? {}, "workflow input"),
            runId,
            startedByUserId: run.started_by_user_id,
          },
        });
        continue;
      }
      const { rows: blobs } = await query(
        `SELECT channel, type, blob FROM "${schema}".checkpoint_blobs b
         JOIN jsonb_each_text($2::jsonb -> 'channel_versions') v
           ON b.channel = v.key AND b.version = v.value
         WHERE b.thread_id = $1 AND b.checkpoint_ns = ''`,
        [run.thread_id ?? run.id, saved.checkpoint],
      );
      const { rows: writes } = await query(
        `SELECT task_id, channel, type, blob FROM "${schema}".checkpoint_writes
         WHERE thread_id = $1 AND checkpoint_ns = '' AND checkpoint_id = $2 ORDER BY task_id, idx`,
        [run.thread_id ?? run.id, saved.checkpoint_id],
      );
      imports.push(decodeLegacyWorkflowImport(run, saved.checkpoint, blobs, writes));
    }
    await query("COMMIT");
    return imports;
  } catch (error) {
    await query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool?.end();
  }
}

/** Decode only the plain state and linear scheduling channels used by this application's old workflows. */
function decodeLegacyWorkflowImport(
  run: Record<string, unknown>,
  rawCheckpoint: unknown,
  blobs: Record<string, unknown>[],
  writes: Record<string, unknown>[],
): LegacyWorkflowImport {
  const runId = requiredString(run.id, "run id");
  const workflowName = requiredString(run.workflow_name, "workflow name");
  const checkpoint = record(rawCheckpoint, "checkpoint");
  if (checkpoint.v !== 3 && checkpoint.v !== 4)
    throw new Error(`Unsupported legacy checkpoint version for run ${runId}.`);
  const nodes = workflowNodes[workflowName];
  if (!nodes) throw new Error(`Cannot import unsupported Agent workflow ${workflowName}.`);
  const versions = record(checkpoint.channel_versions, "channel versions");
  const seen = record(checkpoint.versions_seen ?? {}, "seen versions");
  const channels = new Map<string, unknown>();
  for (const blob of blobs) {
    if (blob.type === "empty") continue;
    const channel = String(blob.channel);
    if (channel.startsWith("branch:to:") && !nodes.includes(channel.slice("branch:to:".length))) {
      throw new Error(`Unsupported legacy scheduling channel ${channel}.`);
    }
    if (channel.startsWith("join:"))
      throw new Error("Legacy checkpoint contains an unsupported join.");
    channels.set(channel, decodeBlob(blob));
  }
  const state = Object.fromEntries([...channels].filter(([name]) => businessChannels.has(name)));
  let next = nodes.filter((node) => {
    const channel = `branch:to:${node}`;
    if (!channels.has(channel)) return false;
    const observed = record(seen[node] ?? {}, "node versions")[channel];
    return newerVersion(versions[channel], observed);
  });
  const successfulTasks = new Set(
    writes
      .filter(
        (write) =>
          businessChannels.has(String(write.channel)) ||
          String(write.channel).startsWith("branch:to:"),
      )
      .map((write) => String(write.task_id)),
  );
  if (successfulTasks.size > 1)
    throw new Error(`Legacy Agent run ${runId} has unsupported concurrent pending writes.`);
  if (successfulTasks.size === 1) {
    next = [];
    for (const write of writes) {
      if (!successfulTasks.has(String(write.task_id))) continue;
      const channel = String(write.channel);
      if (businessChannels.has(channel)) state[channel] = decodeBlob(write);
      else if (channel.startsWith("branch:to:")) {
        const node = channel.slice("branch:to:".length);
        if (!nodes.includes(node)) throw new Error(`Unsupported legacy next node ${node}.`);
        next.push(node);
      }
    }
  }
  if (next.length === 0 && channels.has("__start__")) {
    Object.assign(state, record(channels.get("__start__"), "initial state"));
    next = [nodes[0]];
  }
  if (next.length > 1)
    throw new Error(`Legacy Agent run ${runId} has unsupported concurrent next nodes.`);
  if (state.runId !== run.id)
    throw new Error(`Legacy checkpoint does not belong to Agent run ${runId}.`);
  if (run.status === "WAITING_FOR_APPROVAL") {
    const interruption = record(run.interruption, "waiting approval");
    if (!interruption.approvalId)
      throw new Error(`Legacy Agent run ${runId} has no persisted approval identity.`);
    if (
      next.length !== 1 ||
      ![
        "human_approval",
        "request_article_approval",
        "request_audit_approval",
        "request_site_config_approval",
        "request_multi_task_approval",
      ].includes(next[0])
    ) {
      throw new Error(`Legacy Agent run ${runId} does not have a resumable approval checkpoint.`);
    }
    state.approval = null;
  }
  restoreSnapshotDates(state);
  return { runId, next: [...new Set(next)], state };
}

function decodeBlob(blob: Record<string, unknown>): unknown {
  if (blob.type !== "json" || !(blob.blob instanceof Uint8Array)) {
    throw new Error(`Unsupported legacy serialization for channel ${String(blob.channel)}.`);
  }
  return JSON.parse(new TextDecoder().decode(blob.blob), (key, value: unknown) => {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("Unsafe legacy checkpoint property.");
    if (value && typeof value === "object" && "lc" in value) {
      if (value.lc === 2 && "type" in value && value.type === "undefined") return undefined;
      throw new Error("Legacy checkpoint contains an unsupported serialized constructor.");
    }
    return value;
  });
}

function newerVersion(version: unknown, observed: unknown) {
  if (typeof version !== "string" && typeof version !== "number")
    throw new Error("Invalid legacy channel version.");
  if (observed === undefined) return true;
  if (typeof version === "string" && typeof observed === "string") return version > observed;
  if (typeof version === "number" && typeof observed === "number") return version > observed;
  throw new Error("Incompatible legacy channel versions.");
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid legacy ${label}.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Invalid legacy ${label}.`);
  return value;
}

function restoreSnapshotDates(state: Record<string, unknown>) {
  for (const name of ["comments", "articles", "logs", "findings"]) {
    if (!Array.isArray(state[name])) continue;
    for (const item of state[name]) restoreDates(record(item, name));
  }
  if (state.article) restoreDates(record(state.article, "article"));
  if (state.siteConfig) {
    const site = record(state.siteConfig, "site config");
    if (Array.isArray(site.announcements)) {
      site.announcements = site.announcements.map((item) => {
        const stored = record(item, "announcement");
        // The old runner stored SiteAnnouncement instances as their enumerable private props.
        const announcement = Object.hasOwn(stored, "props")
          ? record(stored.props, "announcement props")
          : stored;
        restoreDates(announcement);
        return announcement;
      });
    }
  }
}

function restoreDates(value: Record<string, unknown>) {
  for (const name of ["createdAt", "updatedAt", "publishedAt", "decidedAt", "executedAt"]) {
    const stored = value[name];
    if (stored === null || stored === undefined) continue;
    if (typeof stored !== "string" && typeof stored !== "number" && !(stored instanceof Date))
      throw new Error(`Invalid legacy snapshot date ${name}.`);
    const date = new Date(stored instanceof Date ? stored.getTime() : stored);
    if (!Number.isFinite(date.getTime())) throw new Error(`Invalid legacy snapshot date ${name}.`);
    value[name] = date;
  }
}

export { decodeLegacyWorkflowImport, loadLegacyWorkflowImports };
export type { LegacyImportQuery, LegacyWorkflowImport };
