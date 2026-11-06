import type { Command } from "commander";
import { confirm, isCancel } from "@clack/prompts";
import type { ApiClient } from "./api.ts";
import { CliError } from "./errors.ts";

type CommandOptions = Record<string, string | boolean | undefined>;
type CommandHandler = (options: CommandOptions, args: string[], api: ApiClient) => Promise<unknown>;
type RegisterAction = (command: Command, handler: CommandHandler) => void;

async function confirmMutation(options: CommandOptions, message: string): Promise<void> {
  if (options.yes) return;
  if (!process.stdin.isTTY || !process.stderr.isTTY || options.json)
    throw new CliError("CONFIRMATION_REQUIRED", `${message} Pass --yes to confirm explicitly`);
  const decision = await confirm({ message, initialValue: false, output: process.stderr });
  if (isCancel(decision) || !decision) throw new CliError("CANCELLED", "Operation cancelled");
}

export { confirmMutation };
export type { CommandOptions, CommandHandler, RegisterAction };
