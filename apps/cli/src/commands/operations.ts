import type { Command } from "commander";
import type {
  AdminArticleCommentListResponse,
  AdminArticleListResponse,
  AdminGuestbookMessagesResponse,
  AdminOperationLogListResponse,
} from "@adrian-zephyr-notes/contracts";
import type { RegisterAction } from "../core/command.ts";
import { queryPath } from "../core/input.ts";
import { base, listOptions, listQuery, value } from "./admin-input.ts";

function registerOperationCommands(program: Command, action: RegisterAction) {
  const dashboard = program.command("dashboard").description("Administrator overview");
  action(dashboard.command("get"), async (_options, _args, api) => {
    const [articles, drafts, hiddenComments, deletedGuestbook, audit] = await Promise.all([
      api.json<AdminArticleListResponse>(`${base}/articles?page=1&pageSize=5`),
      api.json<AdminArticleListResponse>(`${base}/articles?page=1&pageSize=1&status=DRAFT`),
      api.json<AdminArticleCommentListResponse>(`${base}/comments?page=1&pageSize=1&status=HIDDEN`),
      api.json<AdminGuestbookMessagesResponse>(
        `${base}/guestbook/messages?page=1&pageSize=1&status=DELETED`,
      ),
      api.json<AdminOperationLogListResponse>(`${base}/audit/logs?page=1&pageSize=5`),
    ]);
    return {
      counts: {
        articles: articles.pagination.totalItems,
        drafts: drafts.pagination.totalItems,
        hiddenComments: hiddenComments.pagination.totalItems,
        deletedGuestbook: deletedGuestbook.pagination.totalItems,
      },
      recentArticles: articles.data,
      recentAudit: audit.data,
    };
  });

  const audit = program.command("audit").description("Read administrator operation logs");
  action(
    listOptions(audit.command("list"))
      .option("--action <action>", "Operation action or ALL")
      .option("--actor <login>", "Administrator GitHub login"),
    async (options, _args, api) =>
      api.json(
        queryPath(`${base}/audit/logs`, {
          ...listQuery(options),
          action: value(options, "action"),
          actorLogin: value(options, "actor"),
        }),
      ),
  );
}

export { registerOperationCommands };
