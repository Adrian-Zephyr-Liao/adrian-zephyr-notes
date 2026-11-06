import type { AssistantTurnResponse, AssistantTurnStatus } from "@adrian-zephyr-notes/contracts";
import { MarkdownPreview } from "@adrian-zephyr-notes/markdown";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { AssistantActionCard, AssistantResult, formatAssistantDate } from "./assistant-results";

const statusLabels: Record<AssistantTurnStatus, string> = {
  RUNNING: "处理中",
  CANCELLING: "停止中",
  COMPLETED: "回答完成",
  CANCELLED: "已停止",
  FAILED: "请求失败",
  INTERRUPTED: "请求中断",
};

function AssistantTurn({
  turn,
  onReuseInput,
  allowDecisions = true,
}: {
  turn: AssistantTurnResponse;
  onReuseInput: (input: string) => void;
  allowDecisions?: boolean;
}) {
  const actions = new Map(
    turn.toolResults.flatMap(({ result }) =>
      result.ok && result.kind === "comment_action" ? [[result.data.id, result.data] as const] : [],
    ),
  );
  for (const action of turn.actions) actions.set(action.id, action);
  const messages = turn.messages.some((message) => message.role === "user")
    ? turn.messages
    : [{ id: `${turn.id}:input`, role: "user" as const, content: turn.input }, ...turn.messages];
  return (
    <article className="space-y-4 border-b border-border/45 pb-5 last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={turn.createdAt}>{formatAssistantDate(turn.createdAt)}</time>
        <Badge variant={turn.status === "FAILED" ? "destructive" : "outline"}>
          {statusLabels[turn.status]}
        </Badge>
      </div>
      {messages.map((message) =>
        message.role === "user" ? (
          <div className="ml-auto max-w-[90%] rounded-lg bg-primary/10 px-4 py-3" key={message.id}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">你</p>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <div className="space-y-1" key={message.id}>
            <p className="text-xs font-medium text-muted-foreground">助手</p>
            <MarkdownPreview className="text-sm" content={message.content} variant="stream" />
          </div>
        ),
      )}
      {turn.toolResults
        .filter(({ result }) => !result.ok || result.kind !== "comment_action")
        .map((result) => (
          <AssistantResult key={result.toolCallId} result={result.result} />
        ))}
      {[...actions.values()].map((action) => (
        <AssistantActionCard action={action} allowDecisions={allowDecisions} key={action.id} />
      ))}
      {turn.error ? (
        <p className="text-sm text-destructive" role="alert">
          {turn.error.message}
        </p>
      ) : null}
      {["FAILED", "INTERRUPTED", "CANCELLED"].includes(turn.status) ? (
        <Button onClick={() => onReuseInput(turn.input)} size="sm" variant="outline">
          用此问题重新提问
        </Button>
      ) : null}
    </article>
  );
}

export { AssistantTurn };
