import { cp } from "node:fs/promises";

// Standalone output omits public and static assets; prepare them before serving the build.
process.env.PORT ??= "3002";
process.env.HOSTNAME ??= "127.0.0.1";
const standalone = new URL("../.next/standalone/apps/website/", import.meta.url);
await cp(new URL("../public", import.meta.url), new URL("public", standalone), { recursive: true });
await cp(new URL("../.next/static", import.meta.url), new URL(".next/static", standalone), {
  recursive: true,
});
await import(new URL("server.js", standalone).href);
