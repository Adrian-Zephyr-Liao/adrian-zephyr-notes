import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Command } from "commander";
import type {
  AssistantActionResponse,
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import type { ApiClient } from "../core/api.ts";
import { confirmMutation, type CommandOptions, type RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { positivePage, queryPath, readText } from "../core/input.ts";

const base = "/api/admin/assistant";

function value(options: CommandOptions, key: string) {
  return typeof options[key] === "string" ? options[key] : undefined;
}

function uuid(input: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input))
    throw new CliError("INVALID_ARGUMENT", "Conversation and action IDs must be UUIDs");
  return encodeURIComponent(input);
}

function requestId(input: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input))
    throw new CliError(
      "INVALID_ARGUMENT",
      "Request IDs use 1–160 letters, digits, underscores, or hyphens",
    );
  return encodeURIComponent(input);
}

function turnPath(conversationId: string, turnRequestId: string) {
  return `${base}/conversations/${uuid(conversationId)}/turns/${requestId(turnRequestId)}`;
}

async function settledTurn(api: ApiClient, conversationId: string, turnRequestId: string) {
  const deadline = Date.now() + 10_000;
  while (true) {
    const turn = await api.json<AssistantTurnResponse>(turnPath(conversationId, turnRequestId));
    if (turn.status !== "RUNNING" && turn.status !== "CANCELLING") return turn;
    if (Date.now() >= deadline)
      throw new CliError(
        "ASSISTANT_RESULT_UNKNOWN",
        `Request ${turnRequestId} remains ${turn.status}. Read this same request before deciding what to do next; do not start it again with a new ID`,
      );
    await delay(300);
  }
}

async function actionPreview(
  api: ApiClient,
  conversationId: string,
  actionId: string,
  turnRequestId?: string,
) {
  if (turnRequestId) {
    const turn = await api.json<AssistantTurnResponse>(turnPath(conversationId, turnRequestId));
    return turn.actions.find((action) => action.id.toLowerCase() === actionId.toLowerCase());
  }
  let before: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 5; page++) {
    const history = await api.json<AssistantHistoryResponse>(
      queryPath(`${base}/conversations/${uuid(conversationId)}`, { limit: 100, before }),
    );
    const found = history.turns
      .flatMap((turn) => turn.actions)
      .find((action) => action.id.toLowerCase() === actionId.toLowerCase());
    if (found) return found;
    if (!history.nextBefore || seen.has(history.nextBefore)) break;
    before = history.nextBefore;
    seen.add(before);
  }
  return undefined;
}

function registerAssistantCommands(program: Command, action: RegisterAction) {
  const assistant = program
    .command("assistant")
    .description("Run and inspect your administrator assistant conversations");
  action(assistant.command("capabilities"), async (_options, _args, api) =>
    api.json(`${base}/capabilities`),
  );
  action(assistant.command("create"), async (_options, _args, api) =>
    api.send(`${base}/conversations`, "POST"),
  );
  action(
    assistant
      .command("history <conversation-id>")
      .option("--before <turn-id>", "Older history cursor")
      .option("--limit <number>", "Turns per page, 1–100"),
    async (options, args, api) => {
      const before = value(options, "before");
      if (before !== undefined) uuid(before);
      const limit = value(options, "limit");
      return api.json(
        queryPath(`${base}/conversations/${uuid(args[0])}`, {
          before,
          limit: limit === undefined ? undefined : positivePage(limit, 100),
        }),
      );
    },
  );
  action(assistant.command("turn <conversation-id> <request-id>"), async (_options, args, api) =>
    api.json(turnPath(args[0], args[1])),
  );

  action(
    assistant
      .command("run <conversation-id>")
      .option("--message <text>", "A question or instruction, up to 2000 characters")
      .option("--file <path>", "Read the question from a UTF-8 file, or -")
      .option(
        "--request-id <id>",
        "Stable request identity; reuse it when recovering an uncertain result",
      )
      .option("--events", "Write public progress events as JSON lines to stderr"),
    async (options, args, api) => {
      const conversationId = args[0];
      const path = `${base}/conversations/${uuid(conversationId)}/run`;
      const message = value(options, "message");
      const file = value(options, "file");
      if ((message === undefined) === (file === undefined))
        throw new CliError("INVALID_ARGUMENT", "Provide exactly one of --message or --file");
      const input = (message ?? (await readText(file!))).trim();
      if (!input || input.length > 2000)
        throw new CliError("INVALID_INPUT", "Assistant input must contain 1–2000 characters");
      const turnRequestId = value(options, "requestId") ?? randomUUID();
      requestId(turnRequestId);
      console.error(
        JSON.stringify({ conversationId, requestId: turnRequestId, status: "STARTING" }),
      );
      const { HttpAgent } = await import("@ag-ui/client");
      const agent = new HttpAgent({
        url: path,
        threadId: conversationId,
        initialState: {},
        initialMessages: [{ id: `${turnRequestId}:input`, role: "user", content: input }],
        fetch: (url, init) => api.response(url, init),
      });
      const progress = (event: Record<string, unknown>) => {
        if (options.events)
          console.error(JSON.stringify({ conversationId, requestId: turnRequestId, ...event }));
      };
      const abort = () => agent.abortRun();
      const timeout = setTimeout(abort, 120_000);
      process.once("SIGINT", abort);
      let streamFailed = false;
      let streamFinished = false;
      try {
        await agent.runAgent(
          { runId: turnRequestId, tools: [], context: [], forwardedProps: {} },
          {
            onRunStartedEvent: () => progress({ type: "RUN_STARTED" }),
            onTextMessageContentEvent: ({ event }) =>
              progress({
                type: "TEXT_MESSAGE_CONTENT",
                messageId: event.messageId,
                delta: event.delta,
              }),
            onToolCallStartEvent: ({ event }) =>
              progress({
                type: "TOOL_CALL_START",
                toolCallId: event.toolCallId,
                name: event.toolCallName,
              }),
            onRunFinishedEvent: () => {
              streamFinished = true;
              progress({ type: "RUN_FINISHED" });
            },
            onRunErrorEvent: ({ event }) => {
              streamFailed = true;
              progress({ type: "RUN_ERROR", code: event.code, message: event.message });
            },
          },
        );
      } catch {
        streamFailed = true;
      } finally {
        clearTimeout(timeout);
        process.removeListener("SIGINT", abort);
      }
      let turn: AssistantTurnResponse;
      try {
        turn = await settledTurn(api, conversationId, turnRequestId);
      } catch {
        throw new CliError(
          "ASSISTANT_RESULT_UNKNOWN",
          `Cannot confirm request ${turnRequestId} in conversation ${conversationId}. Read the same request; do not automatically replay it or create a new request ID`,
        );
      }
      if (turn.status === "FAILED" || turn.status === "INTERRUPTED")
        throw new CliError(
          "ASSISTANT_RUN_FAILED",
          `Request ${turnRequestId} is ${turn.status}: ${turn.error?.message ?? "Read the saved turn for details"}`,
        );
      return { ...turn, transport: streamFailed || !streamFinished ? "interrupted" : "finished" };
    },
  );

  action(assistant.command("stop <conversation-id> <request-id>"), async (_options, args, api) => {
    const turn = await api.send<AssistantTurnResponse>(
      `${turnPath(args[0], args[1])}/stop`,
      "POST",
    );
    return turn.status === "RUNNING" || turn.status === "CANCELLING"
      ? settledTurn(api, args[0], args[1])
      : turn;
  });

  action(
    assistant
      .command("decide <conversation-id> <action-id>")
      .requiredOption("--decision <decision>", "CONFIRM or REJECT")
      .option(
        "--request-id <id>",
        "Turn request ID for direct preview; otherwise search up to 500 recent turns",
      )
      .option("--yes", "Confirm this exact moderation decision"),
    async (options, args, api) => {
      const conversationId = uuid(args[0]);
      const actionId = uuid(args[1]);
      const decision = value(options, "decision");
      if (decision !== "CONFIRM" && decision !== "REJECT")
        throw new CliError("INVALID_ARGUMENT", "Decision must be CONFIRM or REJECT");
      const preview: AssistantActionResponse | undefined = await actionPreview(
        api,
        args[0],
        args[1],
        value(options, "requestId"),
      );
      if (!preview)
        throw new CliError(
          "NOT_FOUND",
          "Action was not found in owned history; supply --request-id for its original turn",
        );
      await confirmMutation(
        options,
        `${decision} assistant comment action ${JSON.stringify({ actionId: preview.id, commentId: preview.commentId, body: preview.commentBody, author: preview.authorLogin, article: preview.articleTitle, currentStatus: preview.currentStatus, targetStatus: preview.targetStatus })}?`,
      );
      try {
        return await api.send(
          `${base}/conversations/${conversationId}/actions/${actionId}/decision`,
          "POST",
          { decision },
        );
      } catch (error) {
        if (error instanceof CliError && error.status && error.status < 500) throw error;
        throw new CliError(
          "ASSISTANT_DECISION_UNKNOWN",
          `Decision ${decision} for action ${args[1]} may already be saved. Read the original turn and retry only this same action and decision; do not submit the opposite decision`,
        );
      }
    },
  );
}

export { registerAssistantCommands };
