import type {
  AdminArticleListItemResponse,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleAlert,
  FilePenLine,
  MessageCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  listAdminArticleComments,
  listAdminArticles,
  listAdminGuestbookMessages,
  listAdminOperationLogs,
} from "../../lib/admin-api";
import { cn } from "../../lib/utils";

type DashboardSnapshot = {
  draftCount: number;
  hiddenCommentCount: number;
  recentArticles: AdminArticleListItemResponse[];
  recentLogs: AdminOperationLogResponse[];
  removedGuestbookCount: number;
  totalArticles: number;
};

function AdminDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [articles, drafts, hiddenComments, removedGuestbook, logs] = await Promise.all([
        listAdminArticles({ page: 1, pageSize: 5, status: "ALL" }),
        listAdminArticles({ page: 1, pageSize: 1, status: "DRAFT" }),
        listAdminArticleComments({ page: 1, pageSize: 1, status: "HIDDEN" }),
        listAdminGuestbookMessages({ page: 1, pageSize: 1, status: "DELETED" }),
        listAdminOperationLogs({ action: "ALL", page: 1, pageSize: 5 }),
      ]);
      setSnapshot({
        draftCount: drafts.pagination.totalItems,
        hiddenCommentCount: hiddenComments.pagination.totalItems,
        recentArticles: articles.data,
        recentLogs: logs.data,
        removedGuestbookCount: removedGuestbook.pagination.totalItems,
        totalArticles: articles.pagination.totalItems,
      });
    } catch {
      setErrorMessage("工作台数据加载失败，请检查服务端或管理员登录状态。");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = [
    { label: "全部文章", value: snapshot?.totalArticles },
    { label: "待完成草稿", value: snapshot?.draftCount },
    { label: "已隐藏评论", value: snapshot?.hiddenCommentCount },
    { label: "已移除留言", value: snapshot?.removedGuestbookCount },
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">继续创作，或核对最近的互动与改动。</p>
        <div className="flex gap-2">
          <Button disabled={isLoading} variant="outline" onClick={() => void loadDashboard()}>
            <RefreshCw className={cn(isLoading && "animate-spin motion-reduce:animate-none")} />
            {isLoading ? "刷新中" : "刷新"}
          </Button>
          <Button asChild>
            <Link to="/articles/new">
              <FilePenLine />
              写文章
            </Link>
          </Button>
        </div>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage} 使用上方“刷新”重新读取。
        </p>
      ) : null}
      <section aria-label="运营指标" aria-busy={isLoading} className="border-y border-border py-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {metrics.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {isLoading || errorMessage ? "—" : (value ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {!errorMessage ? (
        <>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="min-w-0">
              <SectionHeader
                title="最近内容"
                description="从最近更新的文章继续编辑"
                actionLabel="查看全部"
                actionTo="/articles"
              />
              {isLoading ? (
                <DashboardRowsSkeleton />
              ) : snapshot?.recentArticles.length ? (
                <div className="divide-y divide-border border-y border-border">
                  {snapshot.recentArticles.map((article) => (
                    <article
                      key={article.id}
                      className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <Link
                          className="rounded-sm text-base/7 font-medium wrap-break-word hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                          params={{ articleId: article.id }}
                          to="/articles/$articleId/edit"
                        >
                          {article.title}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <ArticleStatusBadge status={article.status} />
                          <span>
                            {article.category?.name ?? "未分类"} · {article.wordCount} 字 ·{" "}
                            {article.commentCount} 条评论
                          </span>
                        </div>
                      </div>
                      <time dateTime={article.updatedAt} className="text-xs text-muted-foreground">
                        {formatRelativeDate(article.updatedAt)}
                      </time>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState label="还没有文章，先创建第一篇内容。" />
              )}
            </section>
            <aside className="min-w-0">
              <SectionHeader title="需要复核" description="按实际状态回看草稿和互动" />
              <div className="divide-y divide-border border-y border-border">
                <AttentionItem
                  count={snapshot?.draftCount}
                  icon={FilePenLine}
                  label="草稿等待完成"
                  loading={isLoading}
                  to="/articles"
                />
                <AttentionItem
                  count={snapshot?.hiddenCommentCount}
                  icon={MessageCircle}
                  label="已隐藏评论待复核"
                  loading={isLoading}
                  to="/comments"
                />
                <AttentionItem
                  count={snapshot?.removedGuestbookCount}
                  icon={CircleAlert}
                  label="软删除留言可恢复"
                  loading={isLoading}
                  to="/guestbook"
                />
              </div>
              <nav aria-label="工作台快捷入口" className="mt-6 grid gap-1">
                <QuickLink icon={MessageCircle} label="处理评论" to="/comments" />
                <QuickLink icon={Settings2} label="调整站点配置" to="/site" />
                <QuickLink icon={ShieldCheck} label="查看审计记录" to="/audit" />
              </nav>
            </aside>
          </div>
          <section className="min-w-0">
            <SectionHeader
              title="最近动态"
              description="最近发生的后台写操作"
              actionLabel="完整日志"
              actionTo="/audit"
            />
            {isLoading ? (
              <DashboardRowsSkeleton rows={3} />
            ) : snapshot?.recentLogs.length ? (
              <div className="divide-y divide-border border-y border-border">
                {snapshot.recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm/6 wrap-break-word">
                        {formatDashboardActivitySummary(log, snapshot.recentArticles)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">@{log.actorLogin}</p>
                    </div>
                    <time dateTime={log.createdAt} className="text-xs text-muted-foreground">
                      {formatRelativeDate(log.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="暂无后台操作记录。" />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SectionHeader({
  actionLabel,
  actionTo,
  description,
  title,
}: {
  actionLabel?: string;
  actionTo?: "/articles" | "/audit";
  description: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {actionLabel && actionTo ? (
        <Button asChild size="sm" variant="ghost">
          <Link to={actionTo}>
            {actionLabel}
            <ArrowRight />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function AttentionItem({
  count,
  icon: Icon,
  label,
  loading,
  to,
}: {
  count?: number;
  icon: LucideIcon;
  label: string;
  loading: boolean;
  to: "/articles" | "/comments" | "/guestbook";
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-16 items-center gap-3 rounded-sm py-3 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 wrap-break-word">{label}</span>
      <span className="font-semibold tabular-nums">{loading ? "—" : (count ?? "—")}</span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label: string;
  to: "/audit" | "/comments" | "/site";
}) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function DashboardRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="正在加载工作台数据" aria-busy="true" className="grid gap-3 py-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
function EmptyState({ label }: { label: string }) {
  return <p className="py-10 text-sm text-muted-foreground">{label}</p>;
}
function ArticleStatusBadge({ status }: { status: AdminArticleListItemResponse["status"] }) {
  if (status === "PUBLISHED") return <Badge variant="success">已发布</Badge>;
  if (status === "ARCHIVED") return <Badge variant="outline">已归档</Badge>;
  return <Badge variant="warning">草稿</Badge>;
}

const articleActionLabels = {
  ARTICLE_CREATED: "创建文章",
  ARTICLE_DELETED: "删除文章",
  ARTICLE_UPDATED: "更新文章",
} as const;

function formatDashboardActivitySummary(
  log: AdminOperationLogResponse,
  recentArticles: AdminArticleListItemResponse[],
) {
  if (!(log.action in articleActionLabels)) {
    return log.summary;
  }

  const action = log.action as keyof typeof articleActionLabels;
  const metadataTitle = toNonEmptyText(log.metadata?.articleTitle);
  const currentArticleTitle = recentArticles.find(
    (article) => article.id === log.resourceId,
  )?.title;
  const articleTitle = metadataTitle || currentArticleTitle;

  return articleTitle ? `${articleActionLabels[action]}《${articleTitle}》` : log.summary;
}

function toNonEmptyText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export { AdminDashboard };
