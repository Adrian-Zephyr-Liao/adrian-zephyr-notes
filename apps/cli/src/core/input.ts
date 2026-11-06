import { open } from "node:fs/promises";
import { CliError, isRecord } from "./errors.ts";

const MAX_INPUT_BYTES = 1024 * 1024;

async function readText(path: string): Promise<string> {
  const stream = path === "-" ? process.stdin : (await open(path, "r")).createReadStream();
  if (path === "-" && process.stdin.isTTY)
    throw new CliError("INVALID_ARGUMENT", "Pipe input to stdin when using '-'");
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_INPUT_BYTES)
        throw new CliError("INPUT_TOO_LARGE", "Input is limited to 1 MiB");
      chunks.push(bytes);
    }
  } catch (error) {
    if (path !== "-") stream.destroy();
    throw error;
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(path: string, allowedKeys?: string[]): Promise<Record<string, unknown>> {
  const text = await readText(path);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CliError("INVALID_INPUT", "Input must contain a JSON object");
  }
  if (!isRecord(value)) throw new CliError("INVALID_INPUT", "Input must contain a JSON object");
  if (allowedKeys) {
    const unknown = Object.keys(value).find((key) => !allowedKeys.includes(key));
    if (unknown) throw new CliError("INVALID_INPUT", `Unknown input field: ${unknown}`);
  }
  return value;
}

function queryPath(path: string, values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) query.set(key, String(value));
  return query.size ? `${path}?${query}` : path;
}

function positivePage(value: string, max = 50): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max)
    throw new CliError("INVALID_ARGUMENT", `Expected a positive integer no greater than ${max}`);
  return Number(value);
}

export { readText, readJson, queryPath, positivePage };
