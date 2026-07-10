import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const forbiddenInternalAgentRoutePatterns = [
  /agent[._-]?runs/i,
  /agent\/runs/i,
  /checkpoint/i,
  /debug/i,
  /langgraph/i,
  /运行面板/,
  /运行态/,
  /运行时/,
];

describe("admin route product boundary", () => {
  it("does not expose internal Agent orchestration panels", () => {
    const routesDirectory = dirname(fileURLToPath(import.meta.url));
    const routeFiles = readdirSync(routesDirectory).filter((fileName) => fileName.endsWith(".tsx"));

    expect(routeFiles).toContain("agent.tsx");
    expect(routeFiles).toContain("audit.tsx");
    expect(routeFiles).not.toContain("agent.runs.tsx");
    expect(
      routeFiles.filter((fileName) =>
        forbiddenInternalAgentRoutePatterns.some((pattern) => pattern.test(fileName)),
      ),
    ).toEqual([]);

    expect(join(routesDirectory, "agent.tsx")).toContain("routes/agent.tsx");
  });

  it("does not link product navigation to orchestration internals", () => {
    const routesDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceRoot = resolve(routesDirectory, "..");
    const files = [
      join(sourceRoot, "features/admin-shell/admin-shell.tsx"),
      join(sourceRoot, "routeTree.gen.ts"),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      expect(
        forbiddenInternalAgentRoutePatterns.filter((pattern) => pattern.test(source)),
        file,
      ).toEqual([]);
    }
  });

  it("does not expose persisted workflow events as a product API surface", () => {
    const routesDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceRoot = resolve(routesDirectory, "..");
    const repositoryRoot = resolve(sourceRoot, "../../..");
    const files = [
      join(repositoryRoot, "apps/admin/src/lib/admin-api.ts"),
      join(repositoryRoot, "apps/server/src/admin-agent/presentation/admin-agent.controller.ts"),
      join(repositoryRoot, "packages/contracts/src/admin/agent.ts"),
      join(repositoryRoot, "packages/contracts/src/index.ts"),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      expect(source, file).not.toMatch(/tasks\/:taskId\/events|tasks\/\$\{taskId\}\/events/);
      expect(source, file).not.toMatch(/listAdminAgentTaskEvents|AdminAgentTaskEventsResponse/);
      expect(source, file).not.toMatch(/AdminAgentTaskEventResponse|AdminAgentTaskEventType/);
    }
  });
});
