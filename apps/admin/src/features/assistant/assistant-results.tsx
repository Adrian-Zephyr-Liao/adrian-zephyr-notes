import type {
  AssistantActionDecision,
  AssistantActionResponse,
  AssistantToolResult,
} from "@adrian-zephyr-notes/contracts";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { decideAssistantAction } from "./assistant-api";

function AssistantResult({ result }: { result: AssistantToolResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
        查询或操作未完成：{result.error.message}
      </div>
    );
  }
  if (result.kind === "comment_action") {
    return <AssistantActionCard action={result.data} />;
  }
  const { data, pagination, queriedAt } = result.data;
  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-background/25">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/45 px-4 py-3">
        <h3 className="text-sm font-semibold">
          {result.kind === "audit_logs" ? "审计记录" : "评论搜索结果"}
        </h3>
        <span className="text-xs text-muted-foreground">
          第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页 · 共{" "}
          {pagination.totalItems} 条
        </span>
      </header>
      <div className="divide-y divide-border/45">
        {result.kind === "audit_logs"
          ? result.data.data.map((log) => (
              <article className="space-y-1 px-4 py-3" key={log.id}>
                <p className="text-sm">{log.summary}</p>
                <p className="text-xs text-muted-foreground">
                  @{log.actorLogin} · {formatAssistantDate(log.createdAt)}
                </p>
                {log.resourceId ? (
                  <p className="text-xs break-all text-muted-foreground">
                    资源编号：{log.resourceId}
                  </p>
                ) : null}
              </article>
            ))
          : result.data.data.map((comment) => (
              <article className="space-y-2 px-4 py-3" key={comment.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{comment.article.title}</p>
                  <Badge variant={comment.status === "VISIBLE" ? "success" : "outline"}>
                    {commentStatusLabel(comment.status)}
                  </Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                <p className="text-xs text-muted-foreground">
                  @{comment.author.login} · {formatAssistantDate(comment.createdAt)}
                </p>
                <Link
                  className="block text-xs break-all text-primary underline-offset-4 hover:underline"
                  search={{ commentId: comment.id }}
                  to="/comments"
                >
                  查看评论：{comment.id}
                </Link>
              </article>
            ))}
        {data.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">没有符合条件的记录。</p>
        ) : null}
      </div>
      <footer className="border-t border-border/45 px-4 py-2 text-xs text-muted-foreground">
        <p>{formatFilters(result.data.filters)}</p>
        查询于 {formatAssistantDate(queriedAt)}；需要其他分页或筛选时请继续提问。
      </footer>
    </section>
  );
}

function AssistantActionCard({
  action: initialAction,
  allowDecisions = true,
}: {
  action: AssistantActionResponse;
  allowDecisions?: boolean;
}) {
  const [action, setAction] = useState(initialAction);
  const [isDeciding, setIsDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setAction(initialAction), [initialAction]);

  async function decide(decision: AssistantActionDecision) {
    if (!allowDecisions || isDeciding || action.status !== "PENDING") return;
    setIsDeciding(true);
    setError(null);
    try {
      setAction(await decideAssistantAction(action.conversationId, action.id, decision));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "确认结果暂时无法读取，请重试以核对已有回执。",
      );
    } finally {
      setIsDeciding(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">单条评论操作预览</h3>
        <Badge variant={action.status === "APPLIED" ? "success" : "outline"}>
          {action.status === "APPLIED"
            ? "已执行"
            : action.status === "REJECTED"
              ? "已拒绝"
              : "等待确认"}
        </Badge>
      </div>
      <p className="text-sm font-medium">{action.articleTitle}</p>
      <blockquote className="border-l-2 border-primary/25 pl-3 text-sm whitespace-pre-wrap">
        {action.commentBody}
      </blockquote>
      <p className="text-xs text-muted-foreground">作者：@{action.authorLogin}</p>
      <Link
        className="block text-xs break-all text-primary underline-offset-4 hover:underline"
        search={{ commentId: action.commentId }}
        to="/comments"
      >
        核对评论：{action.commentId}
      </Link>
      <p className="text-sm">
        预览时状态：{commentStatusLabel(action.currentStatus)} →{" "}
        {commentStatusLabel(action.targetStatus)}
      </p>
      {action.status === "PENDING" ? (
        <>
          <p className="text-xs text-muted-foreground">
            仅修改这条评论。点击下方按钮才会提交；在聊天中回复“同意”不会执行操作。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!allowDecisions || isDeciding}
              onClick={() => void decide("CONFIRM")}
              size="sm"
            >
              {isDeciding ? <Loader2 className="animate-spin" /> : null}
              确认{action.targetStatus === "HIDDEN" ? "隐藏" : "恢复"}评论
            </Button>
            <Button
              disabled={!allowDecisions || isDeciding}
              onClick={() => void decide("REJECT")}
              size="sm"
              variant="outline"
            >
              拒绝操作
            </Button>
          </div>
          {!allowDecisions ? (
            <p className="text-xs text-muted-foreground">当前未开放评论操作，预览记录仅供核对。</p>
          ) : null}
        </>
      ) : null}
      {action.receipt ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          已于 {formatAssistantDate(action.receipt.appliedAt)}设为
          {commentStatusLabel(action.receipt.status)}，审计记录已保存。
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function formatAssistantDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function commentStatusLabel(status: "VISIBLE" | "HIDDEN") {
  return status === "VISIBLE" ? "可见" : "已隐藏";
}

function formatFilters(filters: Record<string, string | number | null>) {
  const values = Object.entries(filters).flatMap(([key, value]) => {
    if (value === null || value === "" || value === "ALL" || !(key in filterLabels)) return [];
    const readable =
      value === "VISIBLE" || value === "HIDDEN" ? commentStatusLabel(value) : String(value);
    return [`${filterLabels[key]}：${readable}`];
  });
  return values.length ? `生效筛选 · ${values.join(" · ")}` : "生效筛选：未限定其他条件";
}

const filterLabels: Record<string, string> = {
  action: "操作类型",
  actorLogin: "操作者",
  search: "关键词",
  q: "关键词",
  articleId: "文章编号",
  articleSlug: "文章",
  articleTitle: "文章标题",
  authorLogin: "评论作者",
  author: "评论作者",
  body: "评论正文",
  content: "评论正文",
  query: "关键词",
  commentId: "评论编号",
  bodyQuery: "评论正文",
  status: "评论状态",
  createdAfter: "开始时间",
  createdBefore: "结束时间",
  createdFrom: "开始时间",
  createdTo: "结束时间",
  createdToExclusive: "结束时间（不含）",
};

export { AssistantActionCard, AssistantResult, formatAssistantDate };
