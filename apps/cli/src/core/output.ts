import { inspect } from "node:util";
import { note } from "@clack/prompts";
import pc from "picocolors";
import { CliError } from "./errors.ts";

function machineOutput(args: string[]): boolean {
  return args.includes("--json") || !process.stdout.isTTY;
}

function writeResult(value: unknown, json: boolean): void {
  if (value === undefined) return;
  process.stdout.write(
    json
      ? `${JSON.stringify(value)}\n`
      : `${pc.green("✓")} ${inspect(value, { colors: pc.isColorSupported, depth: 8, compact: false })}\n`,
  );
}

function writeError(error: unknown, json: boolean): void {
  const known = error instanceof CliError;
  const data = {
    code: known ? error.code : "CLI_ERROR",
    message: error instanceof Error ? error.message : "Command failed",
    ...(known && error.status ? { status: error.status } : {}),
  };
  process.stderr.write(
    json
      ? `${JSON.stringify({ error: data })}\n`
      : `${pc.red("✗")} ${data.message} (${data.code})\n`,
  );
}

function showDeviceAuthorization(url: string, code: string): void {
  const message = `Open ${url}\nEnter/verify code: ${code}\nWaiting for browser approval (you can use another device).`;
  if (process.stderr.isTTY) note(message, "Authorize AZ Notes CLI", { output: process.stderr });
  else process.stderr.write(`${message}\n`);
}

export { machineOutput, writeResult, writeError, showDeviceAuthorization };
