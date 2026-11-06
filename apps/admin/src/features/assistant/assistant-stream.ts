import type { HttpAgent } from "@ag-ui/client";
import { AdminApiError, requestAdminResponse } from "../../lib/admin-http";

type AssistantStreamInput = {
  conversationId: string;
  requestId: string;
  input: string;
  onStarted?: () => void;
  onTextDelta: (delta: string, messageId: string) => void;
  onToolStart: (name: string) => void;
};

type AssistantStreamResult = {
  terminal: "finished" | "error" | "interrupted";
  error?: string;
};

function streamAssistantTurn(input: AssistantStreamInput) {
  let agent: HttpAgent | undefined;
  let result: AssistantStreamResult = { terminal: "interrupted" };
  let aborted = false;
  const finished = import("@ag-ui/client")
    .then(async ({ HttpAgent: Agent }) => {
      if (aborted) return;
      agent = new Agent({
        url: `/api/admin/assistant/conversations/${encodeURIComponent(input.conversationId)}/run`,
        threadId: input.conversationId,
        initialState: {},
        initialMessages: [{ id: `${input.requestId}:input`, role: "user", content: input.input }],
        fetch: requestAdminResponse,
      });
      await agent.runAgent(
        { runId: input.requestId, tools: [], context: [], forwardedProps: {} },
        {
          onRunStartedEvent: () => input.onStarted?.(),
          onTextMessageContentEvent: ({ event }) => input.onTextDelta(event.delta, event.messageId),
          onToolCallStartEvent: ({ event }) => input.onToolStart(event.toolCallName),
          onRunFinishedEvent: () => {
            result = { terminal: "finished" };
          },
          onRunErrorEvent: ({ event }) => {
            result = { terminal: "error", error: event.message };
          },
        },
      );
    })
    .then(
      (): AssistantStreamResult => (aborted ? { terminal: "interrupted" } : result),
      (error: unknown): AssistantStreamResult => ({
        terminal: result.terminal === "error" && !aborted ? "error" : "interrupted",
        error:
          result.error ??
          (error instanceof AdminApiError ? error.message : "连接中断，请刷新请求状态。"),
      }),
    );

  return {
    abort: () => {
      aborted = true;
      agent?.abortRun();
    },
    finished,
  };
}

export { streamAssistantTurn };
export type { AssistantStreamInput, AssistantStreamResult };
