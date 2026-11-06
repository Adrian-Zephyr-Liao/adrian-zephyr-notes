import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const sha = "a".repeat(40);
const folders: string[] = [];
const proxy =
  "reverse_proxy website:3002\nreverse_proxy admin:80\nerp.zephyrai.site {\n reverse_proxy garment-erp-web:80\n}\n";

afterEach(() =>
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })),
);

function deploy(extra: Record<string, string | undefined> = {}) {
  const root = mkdtempSync(join(tmpdir(), "azn-deploy-"));
  folders.push(root);
  for (const path of ["scripts", "deploy/docker/caddy", ".git", "bin"])
    mkdirSync(join(root, path), { recursive: true });
  cpSync(new URL("./deploy-docker.sh", import.meta.url), join(root, "scripts/deploy-docker.sh"));
  cpSync(
    new URL("./select-deploy-services.sh", import.meta.url),
    join(root, "scripts/select-deploy-services.sh"),
  );
  writeFileSync(join(root, ".git/az-notes-last-deployed"), `${sha}\n`);
  writeFileSync(join(root, "deploy/docker/prod.env"), "");
  writeFileSync(join(root, "deploy/docker/docker-compose.prod.yml"), "services: {}\n");
  writeFileSync(join(root, "deploy/docker/caddy/Caddyfile"), proxy);
  const commands: Record<string, string> = {
    git: `if [[ "$*" != *"diff --name-only"* ]]; then echo ${sha}; fi`,
    flock: 'exit "${LOCK_FAIL:-0}"',
    sleep: ":",
    curl: 'echo curl >> "$TEST_LOG"; exit "${CURL_FAIL:-0}"',
    awk: 'if [[ "$*" == *"/proc/meminfo"* ]]; then echo "${AVAILABLE_KB:-1048576}"; else /usr/bin/awk "$@"; fi',
    docker: `
      echo "$*" >> "$TEST_LOG"
      if [[ "$1 $2" == 'image inspect' ]]; then
        [[ "\${MISSING_IMAGE:-0}" == 0 ]] || exit 1
        echo linux/amd64
      elif [[ "$1" == cp ]]; then
        mkdir -p "$3"
        echo static-asset > "$3/old-chunk.js"
      elif [[ "$1" == exec && "$2" == -i ]]; then
        cat > /dev/null
      elif [[ "$1" == compose ]]; then
        if [[ "$*" == *'ps -q caddy' ]]; then echo caddy-id
        elif [[ "$*" == *'ps -q website' ]]; then echo old-website
        elif [[ "$*" == *'ps -q admin' ]]; then echo old-admin
        elif [[ "$*" == *'ps -q server' ]]; then echo old-server
        fi
      elif [[ "$1" == inspect && "$*" == *'.State.Status'* ]]; then
        echo "running \${CANDIDATE_HEALTH:-healthy}"
      elif [[ "$1" == inspect && "$*" == *'.Config.Env'* ]]; then
        printf 'WEBSITE_HOST=website.test\\nADMIN_HOST=admin.test\\n'
      elif [[ "$1" == inspect && "$*" == *'.Image'* ]]; then
        echo sha256:old-server
      fi`,
  };
  for (const [name, body] of Object.entries(commands))
    writeFileSync(join(root, "bin", name), `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
  const log = join(root, "commands.log");
  writeFileSync(log, "");
  const result = spawnSync("bash", [join(root, "scripts/deploy-docker.sh")], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${root}/bin:${process.env.PATH}`,
      TEST_LOG: log,
      RELEASE_SHA: sha,
      DEPLOY_SERVICES: "website",
      ...extra,
    },
  });
  return {
    ...result,
    log: readFileSync(log, "utf8"),
    proxy: readFileSync(join(root, "deploy/docker/caddy/Caddyfile"), "utf8"),
    root,
  };
}

describe("production release safety", () => {
  it.each([
    { MISSING_IMAGE: "1" },
    { AVAILABLE_KB: "100" },
    { LOCK_FAIL: "1" },
    { DEPLOY_SERVICES: "server" },
  ])("keeps services untouched when preflight fails: %o", (env) => {
    const result = deploy(env);
    expect(result.status).not.toBe(0);
    expect(result.proxy).toBe(proxy);
    expect(result.log).not.toMatch(/ run | up |^stop |caddy reload/m);
  });

  it("keeps the old route when a candidate is unhealthy", () => {
    const result = deploy({ CANDIDATE_HEALTH: "unhealthy" });
    expect(result.status).not.toBe(0);
    expect(result.proxy).toBe(proxy);
    expect(result.log).toContain("rm -f azn-website-");
    expect(result.log).not.toMatch(/^stop |caddy reload/m);
  });

  it("restores the old route if the routed smoke check fails", () => {
    const result = deploy({ CURL_FAIL: "1" });
    expect(result.status).not.toBe(0);
    expect(result.proxy).toBe(proxy);
    expect(result.log.match(/caddy reload/g)).toHaveLength(2);
    expect(result.log).toContain("start old-website");
    expect(result.log).not.toContain("stop --time 30 old-website");
  });

  it("switches only after health checks, preserving ERP and avoiding builds", () => {
    const result = deploy();
    expect(result.status, result.stderr).toBe(0);
    expect(result.proxy).toContain("reverse_proxy azn-website-");
    expect(result.proxy).toContain("reverse_proxy garment-erp-web:80");
    expect(result.log.indexOf(".State.Status")).toBeLessThan(result.log.indexOf("caddy reload"));
    expect(result.log).toContain("update --restart unless-stopped azn-website-");
    expect(result.log.indexOf("curl")).toBeLessThan(
      result.log.indexOf("stop --time 30 old-website"),
    );
    expect(result.log).not.toMatch(/\bbuild\b|remove-orphans|^stop (server|caddy|postgres)/m);
    expect(readFileSync(join(result.root, ".git/az-notes-last-deployed"), "utf8").trim()).toBe(sha);
  });
});
