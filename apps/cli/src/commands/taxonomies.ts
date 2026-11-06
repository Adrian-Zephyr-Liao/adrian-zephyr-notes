import type { Command } from "commander";
import { confirmMutation, type RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { queryPath } from "../core/input.ts";
import { base, fields, id, listOptions, listQuery, value } from "./admin-input.ts";

function registerTaxonomyCommands(program: Command, action: RegisterAction) {
  for (const name of ["categories", "tags"] as const) {
    const group = program.command(name).description(`Article ${name}`);
    const path = `${base}/article-${name}`;
    const keys = name === "categories" ? ["name", "slug", "description"] : ["name", "slug"];
    action(listOptions(group.command("list")), async (options, _args, api) =>
      api.json(queryPath(path, listQuery(options))),
    );
    for (const operation of ["create", "update"] as const) {
      const command = group
        .command(operation === "update" ? "update <id>" : "create")
        .option("--input <path>", "JSON file, or - for stdin")
        .option("--name <name>", "Display name")
        .option("--slug <slug>", "Stable slug");
      if (name === "categories") command.option("--description <text>", "Category description");
      action(command, async (options, args, api) => {
        const body = await fields(options, keys, Object.fromEntries(keys.map((key) => [key, key])));
        if (
          operation === "create" &&
          ["name", "slug"].some((key) => typeof body[key] !== "string" || !body[key].trim())
        )
          throw new CliError("INVALID_INPUT", "Creation requires a nonempty name and slug");
        return api.send(
          operation === "create" ? path : `${path}/${id(args[0])}`,
          operation === "create" ? "POST" : "PATCH",
          body,
        );
      });
    }
    action(
      group.command("delete <id>").option("--yes", "Confirm permanent deletion"),
      async (options, args, api) => {
        const resourceId = id(args[0]);
        await confirmMutation(options, `Permanently delete ${name} ${args[0]}?`);
        await api.send(`${path}/${resourceId}`, "DELETE");
        return { deleted: true, id: args[0] };
      },
    );
    if (name === "tags") {
      action(
        group
          .command("merge <source-id>")
          .requiredOption("--target <target-id>", "Destination tag UUID")
          .option("--yes", "Confirm moving references and deleting the source"),
        async (options, args, api) => {
          const sourceId = id(args[0]);
          const targetTagId = value(options, "target")!;
          id(targetTagId);
          if (args[0].toLowerCase() === targetTagId.toLowerCase())
            throw new CliError("INVALID_INPUT", "Source and target tags must differ");
          await confirmMutation(
            options,
            `Move all references from tag ${args[0]} to ${targetTagId}, then permanently delete the source?`,
          );
          return api.send(`${path}/${sourceId}/merge`, "POST", { targetTagId });
        },
      );
    }
  }
}

export { registerTaxonomyCommands };
