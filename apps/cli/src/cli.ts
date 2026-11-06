import { Command, CommanderError } from "commander";
import pc from "picocolors";
import { login, logout } from "./auth/device.ts";
import { resolveAuth } from "./auth/credentials.ts";
import { ApiClient } from "./core/api.ts";
import { CliError } from "./core/errors.ts";
import type { CommandOptions, RegisterAction } from "./core/command.ts";
import { registerArticleCommands } from "./commands/articles.ts";
import { registerImageCommands } from "./commands/images.ts";
import { registerAdminCommands } from "./commands/admin.ts";
import { registerAssistantCommands } from "./commands/assistant.ts";

async function runCli(args: string[]): Promise<unknown> {
  let result: unknown;
  let help = "";
  const program = new Command()
    .name("azn")
    .description("AZ Notes administrator CLI for people and Agents")
    .version("0.2.0")
    .option("--server <origin>", "API origin; defaults to AZN_SERVER_URL or saved login")
    .option("--json", "Machine-readable output without interactive prompts")
    .option("--no-color", "Disable terminal colors")
    .exitOverride()
    .configureOutput({
      writeOut: (text) => {
        help += text;
      },
      writeErr: () => {},
    })
    .configureHelp({
      showGlobalOptions: true,
      styleTitle: (text) =>
        process.stdout.isTTY && !args.includes("--no-color") ? pc.bold(text) : text,
    })
    .addHelpText(
      "after",
      "\nNon-TTY output is JSON. Writes are never retried automatically.\nRun 'azn <group> --help' for commands and options.",
    );

  const action: RegisterAction = (command, handler) => {
    command.action(async (...values: unknown[]) => {
      const current = values.at(-1) as Command;
      const options = current.optsWithGlobals<CommandOptions>();
      const auth = await resolveAuth(
        typeof options.server === "string" ? options.server : undefined,
      );
      result = await handler(
        options,
        current.processedArgs as string[],
        new ApiClient(auth.server, auth.token),
      );
    });
  };
  const auth = program.command("auth").description("OAuth device login and local credentials");
  auth
    .command("login")
    .description("Authorize on another browser; no inbound SSH port needed")
    .option("--no-browser", "Print the approval URL without opening a browser")
    .option("--read-only", "Request admin:read only")
    .option("--scope <scopes>", "Explicit space-separated OAuth scopes")
    .action(async (_options, command: Command) => {
      const options = command.optsWithGlobals<CommandOptions>();
      result = await login(
        typeof options.server === "string" ? options.server : undefined,
        options.browser === false,
        options.readOnly === true,
        typeof options.scope === "string" ? options.scope : undefined,
      );
    });
  auth
    .command("logout")
    .description("Revoke the credential and remove the saved file")
    .action(async (_options, command: Command) => {
      const options = command.optsWithGlobals<CommandOptions>();
      result = await logout(typeof options.server === "string" ? options.server : undefined);
    });
  action(
    auth.command("status").description("Inspect identity, expiry and granted scopes"),
    async (_options, _args, api) => ({
      authenticated: true,
      server: api.server,
      ...(await api.json<Record<string, unknown>>("/api/oauth/me")),
    }),
  );
  action(
    auth.command("whoami").description("Read the current administrator identity"),
    async (_options, _args, api) => api.json("/api/admin/auth/me"),
  );

  registerArticleCommands(program, action);
  registerImageCommands(program, action);
  registerAdminCommands(program, action);
  registerAssistantCommands(program, action);

  const addDuplicateChecks = (command: Command) => {
    const seen = new Set<string>();
    for (const option of command.options)
      command.on(`option:${option.name()}`, () => {
        if (seen.has(option.name()))
          throw new CliError("INVALID_ARGUMENT", `Option --${option.name()} must be supplied once`);
        seen.add(option.name());
      });
    for (const child of command.commands) addDuplicateChecks(child);
  };
  addDuplicateChecks(program);
  try {
    await program.parseAsync(args.length ? args : ["--help"], { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) return help;
      throw new CliError("INVALID_ARGUMENT", error.message.replace(/^error: /, ""));
    }
    throw error;
  }
  return help || result;
}

export { runCli };
