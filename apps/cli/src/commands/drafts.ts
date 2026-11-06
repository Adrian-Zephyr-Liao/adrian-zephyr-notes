import type { Command } from "commander";
import { confirmMutation, type RegisterAction } from "../core/command.ts";
import { queryPath, readJson } from "../core/input.ts";
import { base, id, value } from "./admin-input.ts";

function registerDraftCommands(program: Command, action: RegisterAction) {
  const drafts = program
    .command("drafts")
    .description("Your cloud editor drafts, separate from saved articles");
  action(
    drafts
      .command("get")
      .option("--article-id <id>", "Existing article UUID; omit for a new article"),
    async (options, _args, api) => {
      const articleId = value(options, "articleId");
      if (articleId !== undefined) id(articleId);
      return api.json(queryPath(`${base}/article-drafts/current`, { articleId }));
    },
  );
  action(
    drafts.command("save").requiredOption("--input <path>", "Complete cloud draft JSON file, or -"),
    async (options, _args, api) =>
      api.send(
        `${base}/article-drafts/current`,
        "PUT",
        await readJson(value(options, "input")!, [
          "articleId",
          "baseArticleUpdatedAt",
          "clientSavedAt",
          "values",
        ]),
      ),
  );
  action(
    drafts
      .command("delete")
      .option("--article-id <id>", "Existing article UUID; omit for a new article")
      .option("--yes", "Confirm cloud draft removal"),
    async (options, _args, api) => {
      const articleId = value(options, "articleId");
      if (articleId !== undefined) id(articleId);
      await confirmMutation(
        options,
        `Remove your cloud draft for ${articleId ?? "a new article"}? The article is not deleted.`,
      );
      await api.send(queryPath(`${base}/article-drafts/current`, { articleId }), "DELETE");
      return { deleted: true, articleId: articleId ?? null };
    },
  );
}

export { registerDraftCommands };
