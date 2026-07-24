import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const selectorPath = fileURLToPath(new URL("./select-deploy-services.sh", import.meta.url));

function selectServices(...changedFiles: string[]) {
  const output = execFileSync("bash", [selectorPath, ...changedFiles], {
    encoding: "utf8",
  }).trim();

  return output ? output.split(/\s+/) : [];
}

describe("select-deploy-services", () => {
  it("rebuilds only Admin for an Admin-only change", () => {
    expect(selectServices("apps/admin/src/styles.css")).toEqual(["admin"]);
  });

  it("rebuilds Website and Admin when shared Markdown changes", () => {
    expect(selectServices("packages/markdown/src/styles.css")).toEqual(["website", "admin"]);
  });

  it("rebuilds every application image when shared contracts change", () => {
    expect(selectServices("packages/contracts/src/index.ts")).toEqual([
      "server",
      "website",
      "admin",
    ]);
  });

  it("rebuilds every application image when dependency metadata changes", () => {
    expect(selectServices("pnpm-lock.yaml")).toEqual(["server", "website", "admin"]);
  });

  it("requests a full-stack reconciliation when Compose configuration changes", () => {
    expect(selectServices("deploy/docker/docker-compose.prod.yml")).toEqual(["__full_stack__"]);
  });

  it("skips image builds for documentation-only changes", () => {
    expect(selectServices("docs/deployment/docker-single-server.md")).toEqual([]);
  });

  it("falls back to all images for an unknown application path", () => {
    expect(selectServices("packages/new-runtime/src/index.ts")).toEqual([
      "server",
      "website",
      "admin",
    ]);
  });
});
