import type { Command } from "commander";
import type { AdminSiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import { confirmMutation, type RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { readJson } from "../core/input.ts";
import { base, booleanOption, fields, id, value } from "./admin-input.ts";

function registerSiteCommands(program: Command, action: RegisterAction) {
  const site = program
    .command("site")
    .description("Homepage, navigation, and social link settings");
  action(site.command("get"), async (_options, _args, api) => api.json(`${base}/site-config`));
  action(
    site
      .command("update")
      .requiredOption("--input <path>", "Complete home/navigationItems/socialLinks JSON, or -")
      .option("--yes", "Confirm replacing site settings"),
    async (options, _args, api) => {
      const body = await readJson(value(options, "input")!, [
        "home",
        "navigationItems",
        "socialLinks",
      ]);
      if (!["home", "navigationItems", "socialLinks"].every((key) => Object.hasOwn(body, key)))
        throw new CliError(
          "INVALID_INPUT",
          "Site settings require home, navigationItems, and socialLinks; read site get before replacing them",
        );
      await confirmMutation(
        options,
        "Replace homepage, navigation, and social link settings with the supplied complete document?",
      );
      return api.send(`${base}/site-config/settings`, "PUT", body);
    },
  );

  const announcements = program
    .command("announcements")
    .description("Read and update existing site announcements");
  action(
    announcements.command("list"),
    async (_options, _args, api) =>
      (await api.json<AdminSiteConfigResponse>(`${base}/site-config`)).announcements,
  );
  const announcementKeys = [
    "title",
    "icon",
    "iconClassName",
    "process",
    "status",
    "command",
    "output",
    "isEnabled",
    "sortOrder",
  ];
  const announcement = announcements
    .command("update <id>")
    .option("--input <path>", "Announcement JSON file, or -")
    .option("--title <text>")
    .option("--icon <name>")
    .option("--icon-class-name <classes>")
    .option("--process <text>")
    .option("--status <text>")
    .option("--command <text>")
    .option("--output <text>")
    .option("--enabled <boolean>", "true or false")
    .option("--sort-order <number>")
    .option("--yes", "Confirm immediate reader-facing changes");
  action(announcement, async (options, args, api) => {
    const announcementId = id(args[0]);
    const body = await fields(options, announcementKeys, {
      title: "title",
      icon: "icon",
      iconClassName: "iconClassName",
      process: "process",
      status: "status",
      command: "command",
      output: "output",
      enabled: "isEnabled",
      sortOrder: "sortOrder",
    });
    if (value(options, "enabled") !== undefined)
      body.isEnabled = booleanOption(value(options, "enabled")!);
    if (value(options, "sortOrder") !== undefined)
      body.sortOrder = Number(value(options, "sortOrder"));
    if (body.isEnabled !== undefined && typeof body.isEnabled !== "boolean")
      throw new CliError("INVALID_INPUT", "isEnabled must be a boolean");
    if (
      body.sortOrder !== undefined &&
      (typeof body.sortOrder !== "number" || !Number.isSafeInteger(body.sortOrder))
    )
      throw new CliError("INVALID_INPUT", "sortOrder must be an integer");
    await confirmMutation(options, `Update announcement ${args[0]} with ${JSON.stringify(body)}?`);
    return api.send(`${base}/site-config/announcements/${announcementId}`, "PATCH", body);
  });
}

export { registerSiteCommands };
