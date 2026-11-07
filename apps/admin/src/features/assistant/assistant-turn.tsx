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
    <article className="min-w-0 space-y-4 border-b border-border/45 pb-5 wrap-anywhere last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={turn.createdAt}>{formatAssistantDate(turn.createdAt)}</time>
        <Badge variant={turn.status === "FAILED" ? "destructive" : "outline"}>
          {statusLabels[turn.status]}
        </Badge>
      </div>
      {messages.map((message) => (
        <AssistantMessage content={message.content} key={message.id} role={message.role} />
      ))}
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

function AssistantMessage({ content, role }: { content: string; role: "user" | "assistant" }) {
  return (
    <div
      className={
        role === "user"
          ? "ml-auto w-fit max-w-[90%] min-w-0 rounded-lg rounded-tr-sm border border-primary/10 bg-primary/8 px-4 py-3 wrap-anywhere"
          : "space-y-2 border-l-2 border-primary/25 pl-4"
      }
    >
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {role === "user" ? "你" : "助手"}
      </p>
      {role === "user" ? (
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      ) : (
        <MarkdownPreview
          className="text-sm/relaxed"
          content={content}
          disallowedElements={["img"]}
          variant="stream"
        />
      )}
    </div>
  );
}

export { AssistantTurn, AssistantMessage };
