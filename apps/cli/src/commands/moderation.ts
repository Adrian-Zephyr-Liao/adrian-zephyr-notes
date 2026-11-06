import type { Command } from "commander";
import type { AdminArticleCommentListResponse } from "@adrian-zephyr-notes/contracts";
import { confirmMutation, type RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { queryPath } from "../core/input.ts";
import {
  base,
  booleanOption,
  fields,
  id,
  listOptions,
  listQuery,
  oneOf,
  value,
} from "./admin-input.ts";

function registerModerationCommands(program: Command, action: RegisterAction) {
  const comments = program.command("comments").description("Read and moderate article comments");
  action(
    listOptions(comments.command("list"))
      .option("--status <status>", "ALL, VISIBLE, or HIDDEN")
      .option("--comment-id <id>", "Find a specific comment"),
    async (options, _args, api) => {
      const status = value(options, "status");
      if (status !== undefined) oneOf(status, ["ALL", "VISIBLE", "HIDDEN"], "status");
      const commentId = value(options, "commentId");
      if (commentId !== undefined) id(commentId);
      return api.json(queryPath(`${base}/comments`, { ...listQuery(options), status, commentId }));
    },
  );
  action(
    comments
      .command("update <id>")
      .option("--input <path>", "JSON file, or -")
      .option("--status <status>", "VISIBLE or HIDDEN")
      .option("--yes", "Confirm the displayed moderation target"),
    async (options, args, api) => {
      const commentId = id(args[0]);
      const body = await fields(options, ["status"], { status: "status" });
      oneOf(body.status, ["VISIBLE", "HIDDEN"], "status");
      const preview = await api.json<AdminArticleCommentListResponse>(
        queryPath(`${base}/comments`, { commentId: args[0], pageSize: 1 }),
      );
      const current = preview.data.find(
        (comment) => comment.id.toLowerCase() === args[0].toLowerCase(),
      );
      if (!current) throw new CliError("NOT_FOUND", "Comment was not found for moderation preview");
      await confirmMutation(
        options,
        `Moderate comment ${JSON.stringify({ id: current.id, body: current.body, article: current.article.title, author: current.author.login, previousStatus: current.status, status: body.status })}?`,
      );
      return api.send(`${base}/comments/${commentId}`, "PATCH", body);
    },
  );

  const guestbook = program
    .command("guestbook")
    .description("Read and moderate guestbook messages");
  action(
    listOptions(guestbook.command("list")).option(
      "--status <status>",
      "ALL, VISIBLE, HIDDEN, or DELETED",
    ),
    async (options, _args, api) => {
      const status = value(options, "status");
      if (status !== undefined) oneOf(status, ["ALL", "VISIBLE", "HIDDEN", "DELETED"], "status");
      return api.json(queryPath(`${base}/guestbook/messages`, { ...listQuery(options), status }));
    },
  );
  action(
    guestbook
      .command("update <id>")
      .option("--input <path>", "JSON file, or -")
      .option("--status <status>", "VISIBLE, HIDDEN, or DELETED (recoverable)")
      .option("--pinned <boolean>", "true or false")
      .option("--yes", "Confirm moderation changes"),
    async (options, args, api) => {
      const messageId = id(args[0]);
      const body = await fields(options, ["status", "isPinned"], {
        status: "status",
        pinned: "isPinned",
      });
      if (value(options, "pinned") !== undefined)
        body.isPinned = booleanOption(value(options, "pinned")!);
      if (body.status !== undefined) oneOf(body.status, ["VISIBLE", "HIDDEN", "DELETED"], "status");
      if (body.isPinned !== undefined && typeof body.isPinned !== "boolean")
        throw new CliError("INVALID_INPUT", "isPinned must be a boolean");
      await confirmMutation(
        options,
        `Update guestbook message ${args[0]} with ${JSON.stringify(body)}? DELETED is recoverable.`,
      );
      return api.send(`${base}/guestbook/messages/${messageId}`, "PATCH", body);
    },
  );
}

export { registerModerationCommands };
