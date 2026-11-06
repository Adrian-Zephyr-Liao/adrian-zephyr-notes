import type { Command } from "commander";
import type { CommandOptions } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { positivePage, readJson } from "../core/input.ts";

const base = "/api/admin";

function value(options: CommandOptions, name: string) {
  return typeof options[name] === "string" ? options[name] : undefined;
}

function id(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new CliError("INVALID_ARGUMENT", "Resource IDs must be UUIDs");
  return encodeURIComponent(value);
}

function listOptions(command: Command) {
  return command
    .option("--query <text>", "Search text")
    .option("--page <number>", "Page number")
    .option("--page-size <number>", "Results per page (1–50)");
}

function listQuery(options: CommandOptions) {
  return {
    q: value(options, "query"),
    page:
      value(options, "page") === undefined
        ? undefined
        : positivePage(value(options, "page")!, Number.MAX_SAFE_INTEGER),
    pageSize:
      value(options, "pageSize") === undefined
        ? undefined
        : positivePage(value(options, "pageSize")!),
  };
}

async function fields(
  options: CommandOptions,
  keys: string[],
  optionMap: Record<string, string> = {},
) {
  const path = value(options, "input");
  const result = path === undefined ? {} : await readJson(path, keys);
  for (const [option, field] of Object.entries(optionMap)) {
    const supplied = value(options, option);
    if (supplied !== undefined) result[field] = supplied;
  }
  if (!Object.keys(result).length)
    throw new CliError("INVALID_INPUT", "Provide at least one field to change");
  return result;
}

function oneOf(input: unknown, choices: string[], field: string) {
  if (typeof input !== "string" || !choices.includes(input))
    throw new CliError("INVALID_INPUT", `${field} must be one of ${choices.join(", ")}`);
}

function booleanOption(input: string) {
  if (input !== "true" && input !== "false")
    throw new CliError("INVALID_ARGUMENT", "Boolean options accept true or false");
  return input === "true";
}

export { base, value, id, listOptions, listQuery, fields, oneOf, booleanOption };
