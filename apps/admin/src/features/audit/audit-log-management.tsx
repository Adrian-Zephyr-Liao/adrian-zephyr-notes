import type {
  AdminOperationLogAction,
  AdminOperationLogListQuery,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  Activity,
  ChevronRight,
  FileText,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  ManagementEmpty,
  ManagementLoading,
  ManagementPagination,
} from "../../components/ui/management-surface";
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setIsLoading(true);
    setErrorMessage(null);

    void listAdminOperationLogs(query)
      .then((response) => {
        if (!current) return;
        setLogs(response.data);
        setPagination(response.pagination);
      })
      .catch(() => {
        if (current) setErrorMessage("审计日志加载失败，请检查服务端或管理员权限配置。");
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query]);

  function submitSearch() {
    setQuery((current) => ({
      ...current,
      page: 1,
      q: searchText.trim() || undefined,
    }));
  }

  const groupedLogs = new Map<string, AdminOperationLogResponse[]>();
  for (const log of logs) {
    const date = new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "long",
      timeZone: "Asia/Shanghai",
    }).format(new Date(log.createdAt));
    const group = groupedLogs.get(date) ?? [];
    group.push(log);
    groupedLogs.set(date, group);
  }

  return (
    <section className="min-w-0">
      <div className="grid items-center gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(10rem,1fr)_minmax(15rem,23rem)_14rem_auto_auto]">
        <p className="border-l-2 border-primary pl-4 font-display text-xl font-semibold text-primary">
          全部活动
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索审计日志"
            className="pl-10"
            placeholder="搜索操作、内容或资源"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
          />
        </div>
        <Select
          aria-label="操作类型"
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
        <Button aria-label="搜索日志" variant="outline" onClick={submitSearch}>
          <Search />
          搜索
        </Button>
        <Button variant="ghost" onClick={() => setQuery((current) => ({ ...current }))}>
          <RefreshCw className={cn(isLoading && "animate-spin motion-reduce:animate-none")} />
          刷新
        </Button>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="my-6 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm/6 text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-8 pt-7 xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-10">
        <div className="min-w-0">
          {isLoading ? (
            <ManagementLoading label="正在加载日志..." />
          ) : errorMessage ? null : logs.length === 0 ? (
            <ManagementEmpty label="暂无审计日志。" />
          ) : (
            Array.from(groupedLogs, ([date, records]) => (
              <section key={date} className="mb-8">
                <h2 className="mb-4 font-display text-xl font-semibold">{date}</h2>
                <div className="border-l border-border pl-4 sm:pl-6">
                  {records.map((log) => (
                    <AuditLogItem key={log.id} log={log} />
                  ))}
                </div>
              </section>
            ))
          )}
          {!isLoading && !errorMessage ? (
            <ManagementPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
            />
          ) : null}
        </div>
        <aside className="border-t border-border pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
          <p className="font-display text-2xl/relaxed font-semibold italic">
            保留每一个决定
            <br />
            的上下文。
          </p>
          <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
            <div className="py-4">
              <dt className="text-xs text-muted-foreground">记录总数</dt>
              <dd className="mt-2 tabular-nums">
                {isLoading || errorMessage ? "—" : `${pagination.totalItems} 条`}
              </dd>
            </div>
            <div className="py-4">
              <dt className="text-xs text-muted-foreground">操作范围</dt>
              <dd className="mt-2">
                {query.action && query.action !== "ALL"
                  ? getAuditActionMeta(query.action).label
                  : "全部操作"}
              </dd>
            </div>
            <div className="py-4">
              <dt className="text-xs text-muted-foreground">检索内容</dt>
              <dd className="mt-2 wrap-anywhere">{query.q || "不限关键词"}</dd>
            </div>
          </dl>
          <p className="mt-6 border-l-2 border-primary/30 pl-4 text-xs/7 text-muted-foreground">
            记录内容、互动与站点设置的已提交改动。展开详情，核对当时的资源与操作信息。
          </p>
        </aside>
      </div>
    </section>
  );
}

function AuditLogItem({ log }: { log: AdminOperationLogResponse }) {
  const actionMeta = getAuditActionMeta(log.action);

  const Icon =
    log.resourceType.includes("article") && !log.resourceType.includes("comment")
      ? FileText
      : log.resourceType.includes("comment") || log.resourceType.includes("guestbook")
        ? MessageCircle
        : log.resourceType.includes("site")
          ? Settings2
          : Activity;
  return (
    <article className="relative grid gap-3 border-b border-border py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-4">
      <span
        aria-hidden="true"
        className="absolute top-7 left-[-1.3rem] size-2 rounded-full border border-muted-foreground bg-background sm:left-[-1.8rem]"
      />
      <span
        aria-hidden="true"
        className="hidden size-8 items-center justify-center rounded-sm bg-primary/5 text-primary sm:flex"
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm/6 font-medium wrap-anywhere">{formatAuditSummary(log)}</p>
            <p className="mt-1 text-xs/6 wrap-anywhere text-muted-foreground">
              {formatAuditResourceLabel(log)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
            <span>@{log.actorLogin}</span>
            <time dateTime={log.createdAt} className="tabular-nums">
              {new Intl.DateTimeFormat("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Shanghai",
              }).format(new Date(log.createdAt))}
            </time>
            <Badge variant={actionMeta.variant}>{actionMeta.label}</Badge>
          </div>
        </div>
        <p className="mt-2 text-[11px] wrap-anywhere text-muted-foreground">
          {formatAuditClientLabel(log)}
        </p>
        <AuditMetadataPanel log={log} />
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
    <details className="group mt-3 text-sm">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        查看详情
      </summary>
      <div
        className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-4"
        role="region"
        aria-label="日志详情"
        tabIndex={0}
      >
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
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
    </details>
  );
}

const auditActionMeta: Record<
  AdminOperationLogAction,
  { label: string; variant: "default" | "destructive" | "outline" | "success" | "warning" }
> = {
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

export { AuditLogManagement };
