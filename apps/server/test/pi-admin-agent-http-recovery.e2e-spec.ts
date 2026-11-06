import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { text } from "node:stream/consumers";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAuthSessionRepository } from "../src/auth/infrastructure/prisma-auth-session.repository";

// Opt in with a migrated disposable database, after building the server with `vp run build`.
const databaseUrl = process.env.PI_ATOMIC_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("Pi HTTP recovery through the compiled Nest server", () => {
  const actorId = randomUUID();
  const articleId = randomUUID();
  const login = `pi-http-${actorId}`;
  const scenarios: Scenario[] = [];
  let prisma: PrismaService | undefined;
  let provider: FauxProvider | undefined;
  let application: ChildProcess | undefined;
  let runtimeDirectory: string | undefined;
  let baseUrl: string;
  let cookie: string;
  let applicationOutput = "";

  beforeAll(async () => {
    scenarios.push(
      ...["resume", "stop", "unrelated"].map((name) => ({
        name,
        conversationId: randomUUID(),
        commentId: randomUUID(),
        gate: new AnalysisGate(),
      })),
    );
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
    // An empty runtime must never adopt somebody else's unfinished business work.
    expect(
      await prisma.adminAgentRun.count({
        where: { status: { in: ["PENDING", "RUNNING", "WAITING_FOR_APPROVAL"] } },
      }),
      "PI_ATOMIC_TEST_DATABASE_URL must select a dedicated database without active runs",
    ).toBe(0);
    await prisma.user.create({
      data: { id: actorId, githubId: login, login, profileUrl: "https://example.test/pi-http" },
    });
    const session = await new PrismaAuthSessionRepository(prisma).createSession(actorId);
    cookie = `azn_session=${session.token}`;
    await prisma.article.create({
      data: {
        id: articleId,
        slug: login,
        title: "Pi HTTP recovery fixture",
        description: "Isolated test article",
        markdown: "Only used by the opt-in HTTP recovery test.",
        status: "PUBLISHED",
        publishedAt: new Date(),
        wordCount: 10,
        readingMinutes: 1,
      },
    });
    await prisma.articleComment.createMany({
      data: scenarios.map(({ commentId }) => ({
        id: commentId,
        articleId,
        authorId: actorId,
        body: "测试辱骂内容，仅用于隔离测试。",
      })),
    });
    runtimeDirectory = await mkdtemp(resolve(tmpdir(), "azn-pi-http-"));
    provider = new FauxProvider(scenarios);
    await provider.listen();
    const port = await unusedPort();
    baseUrl = `http://127.0.0.1:${port}`;
    const serverDirectory = resolve(__dirname, "..");
    application = spawn(process.execPath, [resolve(serverDirectory, "dist/main.js")], {
      cwd: serverDirectory,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: String(port),
        ADMIN_GITHUB_LOGINS: login,
        PI_AGENT_STORAGE_DIR: runtimeDirectory,
        LLM_PROVIDER: "openai-compatible",
        LLM_BASE_URL: `${provider.url}/v1`,
        LLM_API_KEY: "pi-http-faux-key",
        LLM_MODEL: "pi-http-faux",
        LLM_CONTEXT_WINDOW: "32768",
        LLM_MAX_TOKENS: "8192",
        LLM_TIMEOUT_MS: "60000",
        COPILOTKIT_TELEMETRY_DISABLED: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const output of [application.stdout, application.stderr])
      output?.setEncoding("utf8").on("data", (chunk: string) => {
        applicationOutput = (applicationOutput + chunk).slice(-20000);
      });
    await vi.waitFor(
      async () => {
        if (application?.exitCode !== null)
          throw new Error(`Compiled server exited during startup:\n${applicationOutput}`);
        const response = await request("/api/admin/auth/me");
        expect((await response.json()).user.id).toBe(actorId);
      },
      { timeout: 20000, interval: 100 },
    );
  }, 30000);

  afterAll(async () => {
    await stopProcess(application);
    await provider?.close();
    try {
      if (prisma) {
        await prisma.adminAgentMessage.deleteMany({
          where: { conversationId: { in: scenarios.map((item) => item.conversationId) } },
        });
        await prisma.adminAgentConversation.deleteMany({
          where: { id: { in: scenarios.map((item) => item.conversationId) } },
        });
        await prisma.adminOperationLog.deleteMany({ where: { actorUserId: actorId } });
        await prisma.adminAgentRun.deleteMany({ where: { startedByUserId: actorId } });
        await prisma.article.deleteMany({ where: { id: articleId } });
        await prisma.user.deleteMany({ where: { id: actorId } });
      }
    } finally {
      await prisma?.$disconnect();
      if (runtimeDirectory) await rm(runtimeDirectory, { recursive: true, force: true });
    }
  }, 20000);

  it("resumes the same analysis after disconnect and scopes durable Stop to its own conversation", async () => {
    const [resumed, stopped, unrelated] = scenarios;
    const first = await chat(resumed!, "ANALYZE");
    const resumedRun = await waitingRun(resumed!);
    first.disconnect.abort();
    await first.response.body?.cancel().catch(() => undefined);
    expect((await run(resumedRun.id)).status).toBe("RUNNING");
    expect(resumed!.gate.cancelled).toBe(0);

    // A fresh message ID resumes the old tool before delivering this follow-up.
    const followUp = await chat(resumed!, "FOLLOW_UP");
    resumed!.gate.release(resumed!.commentId);
    const recovered = await followUp.response.text();
    assertFinished(recovered, resumed!.name);
    expect(recovered).toContain(resumedRun.id);
    expect((await run(resumedRun.id)).status).toBe("COMPLETED");
    expect(await ownRuns(resumed!.commentId)).toHaveLength(1);
    expect(resumed!.gate.requests).toBe(1);
    expect(await prisma!.adminAgentFinding.count({ where: { runId: resumedRun.id } })).toBe(1);

    const second = await chat(stopped!, "ANALYZE");
    const stoppedRun = await waitingRun(stopped!);
    second.disconnect.abort();
    await second.response.body?.cancel().catch(() => undefined);
    expect((await run(stoppedRun.id)).status).toBe("RUNNING");

    // Keep another conversation's business model request active to detect a broad cancellation.
    const other = await chat(unrelated!, "ANALYZE");
    const unrelatedRun = await waitingRun(unrelated!);
    const completedBeforeStop = await run(resumedRun.id);
    await stopConversation(stopped!.conversationId);
    await vi.waitFor(async () => expect((await run(stoppedRun.id)).status).toBe("CANCELLED"));
    await vi.waitFor(() => expect(stopped!.gate.cancelled).toBe(1));
    const cancelledBeforeRepeat = await run(stoppedRun.id);
    const cancelledEvents = await prisma!.adminAgentWorkflowEvent.count({
      where: { runId: stoppedRun.id, type: "CANCELLED" },
    });
    expect(cancelledEvents).toBe(1);
    await stopConversation(stopped!.conversationId);
    expect((await run(stoppedRun.id)).updatedAt).toEqual(cancelledBeforeRepeat.updatedAt);
    expect(
      await prisma!.adminAgentWorkflowEvent.count({
        where: { runId: stoppedRun.id, type: "CANCELLED" },
      }),
    ).toBe(cancelledEvents);
    expect(await run(resumedRun.id)).toEqual(completedBeforeStop);
    expect((await run(unrelatedRun.id)).status).toBe("RUNNING");
    expect(unrelated!.gate.cancelled).toBe(0);
    expect(stopped!.gate.requests).toBe(1);
    unrelated!.gate.release(unrelated!.commentId);
    assertFinished(await other.response.text(), unrelated!.name);
    expect((await run(unrelatedRun.id)).status).toBe("COMPLETED");
    expect(await prisma!.articleComment.count({ where: { articleId, status: "VISIBLE" } })).toBe(3);
    expect(provider!.errors).toEqual([]);
  }, 45000);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(new URL(path, baseUrl), {
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      signal: init.signal ?? AbortSignal.timeout(10000),
    });
    expect(response.ok, `HTTP ${response.status}: ${path}\n${applicationOutput}`).toBe(true);
    return response;
  }

  async function chat(scenario: Scenario, action: "ANALYZE" | "FOLLOW_UP") {
    const disconnect = new AbortController();
    const response = await request("/api/copilotkit", {
      method: "POST",
      signal: AbortSignal.any([disconnect.signal, AbortSignal.timeout(30000)]),
      body: JSON.stringify({
        method: "agent/run",
        params: { agentId: "admin-agent" },
        body: {
          threadId: scenario.conversationId,
          runId: randomUUID(),
          state: {},
          tools: [],
          context: [],
          forwardedProps: { conversationId: scenario.conversationId },
          messages: [
            { id: randomUUID(), role: "user", content: `${action}:${scenario.commentId}` },
          ],
        },
      }),
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    return { response, disconnect };
  }

  async function waitingRun(scenario: Scenario) {
    await vi.waitFor(() => expect(scenario.gate.requests).toBe(1), { timeout: 5000 });
    const rows = await ownRuns(scenario.commentId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("RUNNING");
    return rows[0]!;
  }

  function run(id: string) {
    return prisma!.adminAgentRun.findUniqueOrThrow({ where: { id } });
  }

  async function ownRuns(commentId: string) {
    const rows = await prisma!.adminAgentRun.findMany({ where: { startedByUserId: actorId } });
    return rows.filter((item) => JSON.stringify(item.input).includes(commentId));
  }

  async function stopConversation(conversationId: string) {
    const response = await request(`/api/admin/agent/conversations/${conversationId}/stop`, {
      method: "POST",
    });
    expect(await response.json()).toEqual({ stopped: true });
  }
});

type Scenario = { name: string; conversationId: string; commentId: string; gate: AnalysisGate };
type ModelRequest = {
  messages: Array<{ role: string; content: unknown }>;
  tools?: unknown[];
};

class AnalysisGate {
  requests = 0;
  cancelled = 0;
  private readonly active = new Set<ServerResponse>();

  wait(response: ServerResponse) {
    this.requests++;
    this.active.add(response);
    response.once("close", () => {
      this.active.delete(response);
      if (!response.writableFinished) this.cancelled++;
    });
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.flushHeaders();
  }

  release(commentId: string) {
    const content = JSON.stringify({
      summary: "测试评论分析完成。",
      findings: [
        {
          targetId: commentId,
          category: "ABUSE",
          severity: "HIGH",
          confidence: 0.95,
          reason: "包含测试辱骂。",
          evidence: ["测试辱骂"],
          proposedAction: "HIDE_COMMENT",
        },
      ],
    });
    for (const response of this.active) sendCompletion(response, { content });
  }
}

class FauxProvider {
  readonly errors: string[] = [];
  private readonly server: Server;
  url = "";

  constructor(private readonly scenarios: Scenario[]) {
    this.server = createServer((request, response) => {
      void text(request)
        .then((body) => {
          const input = JSON.parse(body) as ModelRequest;
          const user = input.messages.findLast((message) => message.role === "user");
          const scenario = this.scenarios.find((item) =>
            JSON.stringify(user?.content).includes(item.commentId),
          );
          if (!scenario) throw new Error("Faux provider received an unexpected model request");
          if (!input.tools?.length) {
            scenario.gate.wait(response);
          } else if (
            input.messages.some((message) => message.role === "tool") ||
            JSON.stringify(user?.content).includes("FOLLOW_UP:")
          ) {
            sendCompletion(response, { content: `${scenario.name}_DONE` });
          } else {
            sendCompletion(response, {
              tool_calls: [
                {
                  index: 0,
                  id: `call_${scenario.commentId}`,
                  type: "function",
                  function: {
                    name: "analyze_comments",
                    arguments: JSON.stringify({ commentIds: [scenario.commentId] }),
                  },
                },
              ],
            });
          }
        })
        .catch((error: unknown) => {
          this.errors.push(error instanceof Error ? error.message : String(error));
          response.destroy(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  async listen() {
    this.server.listen(0, "127.0.0.1");
    await once(this.server, "listening");
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async close() {
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function sendCompletion(response: ServerResponse, delta: Record<string, unknown>) {
  if (!response.headersSent) response.writeHead(200, { "Content-Type": "text/event-stream" });
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`);
  response.end(
    `data: ${JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: delta.tool_calls ? "tool_calls" : "stop" }],
    })}\n\ndata: [DONE]\n\n`,
  );
}

function assertFinished(wire: string, marker: string) {
  const events = wire
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as { type: string });
  expect(events.filter((event) => event.type === "RUN_FINISHED")).toHaveLength(1);
  expect(events.some((event) => event.type === "RUN_ERROR")).toBe(false);
  expect(wire).toContain(`${marker}_DONE`);
}

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function stopProcess(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    await exited;
  } finally {
    clearTimeout(timeout);
  }
}
