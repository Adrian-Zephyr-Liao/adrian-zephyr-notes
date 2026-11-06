#!/usr/bin/env node
import { runCli } from "./cli.ts";
import { machineOutput, writeError, writeResult } from "./core/output.ts";

const args = process.argv.slice(2);
const json = machineOutput(args);
try {
  const result = await runCli(args);
  if (typeof result === "string") process.stdout.write(result);
  else writeResult(result, json);
} catch (error) {
  writeError(error, json);
  process.exitCode = 1;
}
