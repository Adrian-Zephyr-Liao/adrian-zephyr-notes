import type {
  AdminOperationLogAction,
  AdminOperationLogListQuery,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { listAdminOperationLogs } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import {
  formatAuditClientLabel,
  formatAuditMetadataEntries,
  formatAuditResourceLabel,
  formatAuditSummary,
} from "./audit-metadata";

const DEFAULT_PAGE_SIZE = 10;

function AuditLogManagement() {
  const [logs, setLogs] = useState<AdminOperationLogResponse[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<AdminOperationLogListQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    action: "ALL",
  });
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);

    void listAdminOperationLogs(query)
      .then((response) => {
        setLogs(response.data);
        setPagination(response.pagination);
      })
      .catch(() => setErrorMessage("审计日志加载失败，请检查服务端或管理员权限配置。"))
      .finally(() => setIsLoading(false));
  }, [query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>审计日志</CardTitle>
            <CardDescription>记录管理员对内容和配置的写操作。</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuery((current) => ({ ...current }))}
          >
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索摘要、资源类型或资源 ID"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    q: searchText.trim() || undefined,
                  }));
                }
              }}
            />
          </div>
          <Select
            value={query.action ?? "ALL"}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                action: event.target.value as AdminOperationLogListQuery["action"],
                page: 1,
              }))
            }
          >
            <option value="ALL">全部动作</option>
            {Object.entries(auditActionMeta).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载日志...
            </div>
          ) : null}
          {logs.map((log) => (
            <AuditLogItem key={log.id} log={log} />
          ))}
          {!isLoading && logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              暂无审计日志。
            </div>
          ) : null}
        </div>
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        />
      </CardContent>
    </Card>
  );
}

function AuditLogItem({ log }: { log: AdminOperationLogResponse }) {
  const actionMeta = getAuditActionMeta(log.action);

  return (
    <article className="rounded-xl border border-border/70 bg-background/65 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionMeta.variant}>{actionMeta.label}</Badge>
            <span className="text-sm font-medium">{formatAuditSummary(log)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{formatAuditResourceLabel(log)}</p>
          <AuditMetadataPanel log={log} />
        </div>
        <div className="text-left text-xs text-muted-foreground md:text-right">
          <p className="font-medium text-foreground">@{log.actorLogin}</p>
          <p>{formatDateTime(log.createdAt)}</p>
          <p className="mt-1 max-w-70 truncate">{formatAuditClientLabel(log)}</p>
        </div>
      </div>
    </article>
  );
}

function AuditMetadataPanel({ log }: { log: AdminOperationLogResponse }) {
  const entries = formatAuditMetadataEntries(log.metadata);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.key} className="min-w-0">
            <dt className="text-[0.7rem] font-medium tracking-normal text-muted-foreground">
              {entry.label}
            </dt>
            <dd className="mt-0.5 text-xs break-all text-foreground">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PaginationControls({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {Math.max(totalPages, 1)} 页
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

const auditActionMeta: Record<
  AdminOperationLogAction,
  { label: string; variant: "default" | "destructive" | "outline" | "success" | "warning" }
> = {
  ADMIN_AGENT_FINDING_CREATED: { label: "Agent 建议", variant: "default" },
  ADMIN_AGENT_FINDING_DECIDED: { label: "Agent 决策", variant: "outline" },
  ADMIN_AGENT_TASK_CONTROLLED: { label: "Agent 操作", variant: "warning" },
  ADMIN_AGENT_TASK_RESUMED: { label: "Agent 确认", variant: "success" },
  ADMIN_AGENT_TASK_STARTED: { label: "Agent 发起", variant: "default" },
  ARTICLE_CREATED: { label: "文章创建", variant: "success" },
  ARTICLE_CATEGORY_CREATED: { label: "分类创建", variant: "success" },
  ARTICLE_CATEGORY_DELETED: { label: "分类删除", variant: "destructive" },
  ARTICLE_CATEGORY_UPDATED: { label: "分类更新", variant: "default" },
  ARTICLE_TAG_CREATED: { label: "标签创建", variant: "success" },
  ARTICLE_TAG_DELETED: { label: "标签删除", variant: "destructive" },
  ARTICLE_TAG_MERGED: { label: "标签合并", variant: "warning" },
  ARTICLE_TAG_UPDATED: { label: "标签更新", variant: "default" },
  ARTICLE_DELETED: { label: "文章删除", variant: "destructive" },
  ARTICLE_UPDATED: { label: "文章更新", variant: "default" },
  COMMENT_STATUS_UPDATED: { label: "评论治理", variant: "warning" },
  GUESTBOOK_MESSAGE_UPDATED: { label: "留言治理", variant: "warning" },
  SITE_ANNOUNCEMENT_UPDATED: { label: "公告更新", variant: "outline" },
  SITE_SETTINGS_UPDATED: { label: "站点配置", variant: "success" },
};

const fallbackAuditActionMeta = { label: "后台操作", variant: "outline" } as const;

function getAuditActionMeta(action: AdminOperationLogAction) {
  return auditActionMeta[action] ?? fallbackAuditActionMeta;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { AuditLogManagement };
