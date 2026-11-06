import { createServer, type ServerResponse } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
describe("Pi assistant P0 compiled Nest integration", () => {
  it("loads compiled CommonJS Nest providers and uses official SSE parsing for tools, repeated Chinese deltas and cancellation", async () => {
    const requests: Array<Record<string, unknown>> = [];
    let cancelled = false;
    const chunk = (response: ServerResponse, delta: unknown, finish: string | null = null) =>
      response.write(
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", model: "MiniMax-M3", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
      );
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const part of request) body += String(part);
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      chunk(response, { role: "assistant" });
      if (requests.length === 1) {
        chunk(response, {
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              type: "function",
              function: { name: "list_audit_logs", arguments: "{}" },
            },
          ],
        });
        chunk(response, {}, "tool_calls");
        response.end("data: [DONE]\n\n");
      } else if (requests.length === 2) {
        chunk(response, { reasoning_content: "private fixture thinking" });
        chunk(response, { content: "哈" });
        chunk(response, { content: "哈" });
        chunk(response, {}, "stop");
        response.end("data: [DONE]\n\n");
      } else {
        response.on("close", () => {
          cancelled = true;
        });
        chunk(response, { content: "正在查询" });
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test upstream did not start.");
    const serverDirectory = join(__dirname, "../../..");
    const directory = await mkdtemp(join(serverDirectory, ".assistant-p0-"));
    try {
      const files = [
        "application/assistant-runner.port.ts",
        "infrastructure/pi-assistant-model.client.ts",
        "infrastructure/pi-assistant-prompt.ts",
        "infrastructure/pi-assistant-projector.ts",
        "infrastructure/pi-assistant.runner.ts",
      ];
      for (const file of files) {
        const source = join(serverDirectory, "src/assistant", file);
        const target = join(directory, "src/assistant", file.replace(/\.ts$/, ".js"));
        await mkdir(dirname(target), { recursive: true });
        const compiled = ts.transpileModule(await readFile(source, "utf8"), {
          fileName: source,
          compilerOptions: {
            target: ts.ScriptTarget.ES2023,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            esModuleInterop: true,
          },
        }).outputText;
        await writeFile(target, compiled);
      }
      await writeFile(
        join(directory, "probe.cjs"),
        `
require("reflect-metadata");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { ConfigService } = require("@nestjs/config");
const { PiAssistantModelClient } = require("./src/assistant/infrastructure/pi-assistant-model.client.js");
const { PiAssistantRunner } = require("./src/assistant/infrastructure/pi-assistant.runner.js");
const { projectAssistantTranscript } = require("./src/assistant/infrastructure/pi-assistant-projector.js");
class ProbeModule {}
Module({ providers: [{ provide: ConfigService, useValue: new ConfigService({ LLM_API_KEY: "fixture-key", LLM_MODEL: "MiniMax-M3", LLM_PROVIDER: "minimax", LLM_BASE_URL: "http://127.0.0.1:${address.port}/v1" }) }, PiAssistantModelClient, PiAssistantRunner] })(ProbeModule);
(async () => {
  const app = await NestFactory.createApplicationContext(ProbeModule, { logger: false });
  try {
    const runner = app.get(PiAssistantRunner); let final; let calls = 0; let text = "";
    const result = { kind: "audit_logs", ok: true, data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, filters: { action: "ALL", actorLogin: null, search: null }, queriedAt: "2026-11-06T00:00:00Z" } };
    const tool = { name: "list_audit_logs", label: "Audit", description: "Read logs", parameters: { type: "object" }, kind: "audit_logs", readOnly: true, execute: async () => { calls++; return result; } };
    for await (const event of runner.stream({ turnId: "p0", message: "查看审计日志", messages: [], tools: [tool] })) { if (event.type === "textDelta") text += event.delta; if (event.type === "finished") final = event; }
    const projected = projectAssistantTranscript("p0", final.messages);
    const controller = new AbortController(); let stopped;
    for await (const event of runner.stream({ turnId: "p0-cancel", message: "取消查询测试", messages: [], tools: [], signal: controller.signal })) { if (event.type === "textDelta") controller.abort(); if (event.type === "finished") stopped = event; }
    process.stdout.write(JSON.stringify({ status: final.status, text, calls, projected, stopped: stopped.status }) + "\\n");
  } finally { await app.close(); }
})().catch(() => { process.stderr.write("Compiled assistant probe failed\\n"); process.exitCode = 1; });
`,
      );
      const { stdout } = await execute(process.execPath, [join(directory, "probe.cjs")], {
        cwd: directory,
        timeout: 15000,
        maxBuffer: 65536,
      });
      const output = JSON.parse(stdout.trim().split("\n").at(-1)!) as {
        status: string;
        text: string;
        calls: number;
        projected: unknown;
        stopped: string;
      };
      expect(output).toMatchObject({
        status: "SUCCEEDED",
        text: "哈哈",
        calls: 1,
        stopped: "CANCELLED",
      });
      expect(JSON.stringify(output.projected)).not.toContain("private fixture thinking");
      expect(requests).toHaveLength(3);
      expect(requests[0]).toMatchObject({
        model: "MiniMax-M3",
        max_completion_tokens: 4096,
        reasoning_split: true,
        thinking: { type: "adaptive" },
      });
      const providerMessages = requests[0]!.messages as Array<{ role: string; content: unknown }>;
      const system = JSON.stringify(
        providerMessages.filter((message) => message.role === "system"),
      );
      for (const rule of [
        "日期约束是审计工具的执行前置条件",
        "本轮不调用任何工具",
        "关键词、作者和文章标题必须逐字保留",
        "成功返回空结果也是有效结果，不得放宽、删除或改写条件重查",
        "未指定分页时只查询page=1、pageSize=20",
        "修正参数格式，不得改变筛选值",
        "不得重复创建预览",
      ])
        expect(system).toContain(rule);
      expect(providerMessages.findLast((message) => message.role === "user")?.content).toEqual([
        { type: "text", text: "查看审计日志" },
      ]);
      expect(cancelled).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  }, 20000);
});
