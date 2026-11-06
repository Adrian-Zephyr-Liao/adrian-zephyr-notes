import type { AdminArticleImageUploadResponse } from "@adrian-zephyr-notes/contracts";
import { Command, Option } from "commander";
import { dirname, resolve } from "node:path";
import { articleInput } from "../content/article-input.ts";
import { prepareMarkdown, uploadMarkdown } from "../content/images.ts";
import { confirmMutation, type CommandOptions, type RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { positivePage, queryPath } from "../core/input.ts";

function articleOptions(command: Command): Command {
  return command
    .option("--input <json-file|->", "Read article fields from JSON")
    .option("--file <markdown-file|->", "Read Markdown; '-' reads stdin")
    .option("--title <text>", "Article title")
    .option("--description <text>", "Article description")
    .option("--category <slug>", "Category slug; empty clears it")
    .option("--tags <slugs>", "Comma-separated tag slugs; empty clears them")
    .option("--cover-image <url>", "Cover URL; empty clears it")
    .addOption(new Option("--origin <origin>", "Article origin").choices(["ORIGINAL", "REPOSTED"]))
    .option("--source-name <text>", "Reposted source name")
    .option("--source-author <text>", "Reposted source author")
    .option("--source-url <url>", "Reposted source URL")
    .option("--upload-images", "Upload local Markdown images before saving")
    .option(
      "--assets-root <directory>",
      "Allowed local images directory; defaults to Markdown parent",
    );
}

function articleValues(options: CommandOptions): CommandOptions {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value,
    ]),
  );
}

function registerArticleCommands(program: Command, action: RegisterAction): void {
  const articles = program.command("articles").description("Write, inspect and publish articles");
  const path = "/api/admin/articles";
  action(
    articles
      .command("list")
      .description("List articles")
      .option("--query <text>", "Search title or description")
      .addOption(new Option("--status <status>").choices(["DRAFT", "PUBLISHED", "ARCHIVED", "ALL"]))
      .addOption(new Option("--origin <origin>").choices(["ORIGINAL", "REPOSTED", "ALL"]))
      .option("--page <number>")
      .option("--page-size <number>"),
    async (options, _args, api) =>
      api.json(
        queryPath(path, {
          q: options.query as string | undefined,
          status: options.status as string | undefined,
          origin: options.origin as string | undefined,
          page: options.page
            ? positivePage(String(options.page), Number.MAX_SAFE_INTEGER)
            : undefined,
          pageSize: options.pageSize ? positivePage(String(options.pageSize)) : undefined,
        }),
      ),
  );
  action(
    articles.command("get <id>").description("Read article and Markdown"),
    async (_options, [id], api) => api.json(`${path}/${encodeURIComponent(id!)}`),
  );
  action(
    articles.command("taxonomies").description("Read category and tag options"),
    async (_options, _args, api) => api.json(`${path}/taxonomies`),
  );
  for (const create of [true, false]) {
    const command = articleOptions(
      articles
        .command(create ? "create" : "update <id>")
        .description(create ? "Create a DRAFT" : "Edit article; editing published content is live"),
    );
    if (!create)
      command.addOption(
        new Option("--status <status>", "Use publish command for publication").choices([
          "DRAFT",
          "ARCHIVED",
        ]),
      );
    action(command, async (options, [id], api) => {
      const payload = await articleInput(articleValues(options), create);
      if (options.assetsRoot && !options.uploadImages)
        throw new CliError("INVALID_ARGUMENT", "--assets-root requires --upload-images");
      let images: Array<AdminArticleImageUploadResponse & { localPath: string }> = [];
      if (options.uploadImages) {
        if (typeof payload.markdown !== "string")
          throw new CliError(
            "INVALID_ARGUMENT",
            "--upload-images requires Markdown in --file or --input",
          );
        const root =
          typeof options.assetsRoot === "string"
            ? options.assetsRoot
            : typeof options.file === "string" && options.file !== "-"
              ? dirname(resolve(options.file))
              : undefined;
        if (!root)
          throw new CliError(
            "INVALID_ARGUMENT",
            "Set --assets-root for Markdown from stdin or JSON input",
          );
        // Validate every local image before uploading the first one.
        const prepared = await prepareMarkdown(payload.markdown, root);
        const rewritten = await uploadMarkdown(api, prepared);
        payload.markdown = rewritten.markdown;
        images = rewritten.images;
      }
      if (images?.length) process.stderr.write(`${JSON.stringify({ imageUploads: images })}\n`);
      return api.send(
        create ? path : `${path}/${encodeURIComponent(id!)}`,
        create ? "POST" : "PATCH",
        payload,
      );
    });
  }
  action(
    articles.command("publish <id>").description("Explicitly publish an existing article"),
    async (_options, [id], api) =>
      api.send(`${path}/${encodeURIComponent(id!)}`, "PATCH", { status: "PUBLISHED" }),
  );
  action(
    articles
      .command("delete <id>")
      .description("Permanently delete an article")
      .option("--yes", "Confirm deletion"),
    async (options, [id], api) => {
      await confirmMutation(options, `Permanently delete article ${id}?`);
      await api.send(`${path}/${encodeURIComponent(id!)}`, "DELETE");
      return { deleted: true, id };
    },
  );
}

export { registerArticleCommands };
