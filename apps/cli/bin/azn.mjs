#!/usr/bin/env node
import { runCli } from "../src/cli.ts";
import { CliError } from "../src/auth.ts";

try {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(typeof result === "string" ? result : `${JSON.stringify(result)}\n`);
} catch (error) {
  const known = error instanceof CliError;
  process.stderr.write(
    `${JSON.stringify({
      error: {
        code: known ? error.code : "CLI_ERROR",
        message: error instanceof Error ? error.message : "Command failed",
        ...(known && error.status ? { status: error.status } : {}),
      },
    })}\n`,
  );
  process.exitCode = 1;
}
