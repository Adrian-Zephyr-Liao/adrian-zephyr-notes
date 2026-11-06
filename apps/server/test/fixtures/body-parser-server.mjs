// Loopback-only Nest shell: no AppModule, database, environment config or provider calls.
import "reflect-metadata";
import { Body, Controller, Get, Module, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { gzipSync } from "node:zlib";

class ProbeController {
  health() {
    return { alive: true };
  }
  echo(body) {
    return body;
  }
}
Controller("probe")(ProbeController);
Get()(
  ProbeController.prototype,
  "health",
  Object.getOwnPropertyDescriptor(ProbeController.prototype, "health"),
);
Post()(
  ProbeController.prototype,
  "echo",
  Object.getOwnPropertyDescriptor(ProbeController.prototype, "echo"),
);
Body()(ProbeController.prototype, "echo", 0);
class ParserTestModule {}
Module({ controllers: [ProbeController] })(ParserTestModule);

async function send(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        agent: false,
        headers: body
          ? {
              "content-type": "application/json",
              "content-encoding": "gzip",
              "content-length": body.length,
            }
          : {},
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
      },
    );
    request.setTimeout(2_000, () => request.destroy(new Error("Local parser probe timed out")));
    request.on("error", reject);
    request.end(body);
  });
}

async function main() {
  // Keep NestFactory's production default parser; do not mask fatal errors with a handler.
  const app = await NestFactory.create(ParserTestModule, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const port = app.getHttpServer().address().port;
    const compressed = gzipSync(Buffer.from('{"parsed":true}'));
    const trailing = process.argv[2] === "trailing";
    // Upstream GHSA-27r3-jxmh-p828 regression: a valid frame plus invalid trailing bytes.
    // https://github.com/expressjs/body-parser/commit/f7075eae3a84c3473ab4bf0a777da28db208e916
    const payload = trailing
      ? Buffer.concat([compressed, Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)])
      : compressed;
    const initial = await send(port, "POST", trailing ? "/no-matching-route" : "/probe", payload);
    // Give errors from the already-finished decoder time to surface before probing survival.
    await delay(200);
    const health = await send(port, "GET", "/probe");
    const subsequent = await send(port, "POST", "/probe", compressed);
    console.log(
      JSON.stringify({
        initialStatus: initial.status,
        healthStatus: health.status,
        subsequentStatus: subsequent.status,
        subsequentBody: subsequent.body,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
