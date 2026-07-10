import { CheckCircle2, CircleMinus, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ConfirmedOperationResult } from "./agent-operation-executor";

type AgentExecutionReceiptProps = {
  className?: string;
  results: ConfirmedOperationResult[];
};

function AgentExecutionReceipt({ className, results }: AgentExecutionReceiptProps) {
  if (results.length === 0) {
    return null;
  }

  const summary = summarizeExecutionResults(results);

  return (
    <div className={cn("mt-3 border-t border-border/60 pt-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">执行回执</p>
        <p className="text-xs text-muted-foreground">{toExecutionReceiptMetricText(summary)}</p>
      </div>
      <ul className="mt-2 grid gap-2" role="list">
        {results.map((result, index) => (
          <li
            key={`${result.findingId}-${result.requestedAction}`}
            className="flex min-w-0 items-start gap-2 text-xs"
          >
            <ExecutionResultIcon result={result} />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">
                {toExecutionResultTitle(result, index)}
              </span>
              <span className="ml-2 text-muted-foreground">
                {toVisibleExecutionCopy(
                  result.error ?? result.reason ?? toExecutionResultStatusLabel(result),
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExecutionResultIcon({ result }: { result: ConfirmedOperationResult }) {
  if (result.error) {
    return <XCircle aria-label="执行失败" className="mt-0.5 size-3.5 shrink-0 text-destructive" />;
  }

  if (result.skipped) {
    return (
      <CircleMinus aria-label="已跳过" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
    );
  }

  return <CheckCircle2 aria-label="已执行" className="mt-0.5 size-3.5 shrink-0 text-primary" />;
}

function summarizeExecutionResults(results: ConfirmedOperationResult[]) {
  return results.reduce(
    (summary, result) => {
      if (result.error) {
        summary.failedCount += 1;
      } else if (result.skipped) {
        summary.skippedCount += 1;
      } else if (result.appliedAction) {
        summary.appliedCount += 1;
      }

      return summary;
    },
    {
      appliedCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
  );
}

function toExecutionSummaryText(summary: ReturnType<typeof summarizeExecutionResults>) {
  const parts = summary.appliedCount > 0 ? [`已执行 ${summary.appliedCount} 条`] : [];

  if (summary.skippedCount > 0) {
    parts.push(`跳过 ${summary.skippedCount} 条`);
  }

  if (summary.failedCount > 0) {
    parts.push(`失败 ${summary.failedCount} 条`);
  }

  return `${parts.length > 0 ? parts.join("，") : "已记录选择"}。`;
}

function toExecutionReceiptMetricText(summary: ReturnType<typeof summarizeExecutionResults>) {
  const parts = summary.appliedCount > 0 ? [`成功 ${summary.appliedCount}`] : [];

  if (summary.skippedCount > 0) {
    parts.push(`跳过 ${summary.skippedCount}`);
  }

  if (summary.failedCount > 0) {
    parts.push(`失败 ${summary.failedCount}`);
  }

  return parts.length > 0 ? parts.join(" / ") : "已记录";
}

function toExecutionResultStatusLabel(result: ConfirmedOperationResult) {
  if (result.skipped) {
    return result.reason ?? "已跳过";
  }

  return result.appliedAction ? "已执行" : "已记录";
}

function toExecutionResultTitle(result: ConfirmedOperationResult, index: number) {
  const itemLabel = `第 ${index + 1} 项`;

  if (result.requestedAction === "hide") {
    return `${itemLabel} · 屏蔽`;
  }

  if (result.requestedAction === "ignore") {
    return `${itemLabel} · 忽略`;
  }

  if (result.requestedAction === "restore") {
    return `${itemLabel} · 恢复`;
  }

  return `${itemLabel} · 继续处理`;
}

function toVisibleExecutionCopy(value: string) {
  return value;
}

export { AgentExecutionReceipt, summarizeExecutionResults, toExecutionSummaryText };
