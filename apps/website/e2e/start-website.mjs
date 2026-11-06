import { cp } from "node:fs/promises";

// Match the deployed standalone runtime; Next does not copy these static assets during build.
const standalone = new URL("../.next/standalone/apps/website/", import.meta.url);
await cp(new URL("../public", import.meta.url), new URL("public", standalone), { recursive: true });
await cp(new URL("../.next/static", import.meta.url), new URL(".next/static", standalone), {
  recursive: true,
});
await import(new URL("server.js", standalone).href);
