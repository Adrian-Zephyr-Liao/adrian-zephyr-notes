import type {
  AdminArticleListItemResponse,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CircleAlert,
  FilePenLine,
  FileText,
  MessageCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  getAdminAgentHome,
  listAdminArticleComments,
  listAdminArticles,
  listAdminGuestbookMessages,
  listAdminOperationLogs,
} from "../../lib/admin-api";
import { cn } from "../../lib/utils";

type DashboardSnapshot = {
  draftCount: number;
  hiddenCommentCount: number;
  pendingFindingCount: number;
  recentArticles: AdminArticleListItemResponse[];
  recentLogs: AdminOperationLogResponse[];
  removedGuestbookCount: number;
  todayCommentCount: number;
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
      const [articles, drafts, agentHome, hiddenComments, removedGuestbook, logs] =
        await Promise.all([
          listAdminArticles({ page: 1, pageSize: 5, status: "ALL" }),
          listAdminArticles({ page: 1, pageSize: 1, status: "DRAFT" }),
          getAdminAgentHome(),
          listAdminArticleComments({ page: 1, pageSize: 1, status: "HIDDEN" }),
          listAdminGuestbookMessages({ page: 1, pageSize: 1, status: "DELETED" }),
          listAdminOperationLogs({ action: "ALL", page: 1, pageSize: 5 }),
        ]);

      setSnapshot({
        draftCount: drafts.pagination.totalItems,
        hiddenCommentCount: hiddenComments.pagination.totalItems,
        pendingFindingCount: agentHome.pendingFindingCount,
        recentArticles: articles.data,
        recentLogs: logs.data,
        removedGuestbookCount: removedGuestbook.pagination.totalItems,
        todayCommentCount: agentHome.todayCommentCount,
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
    {
      icon: FileText,
      label: "全部文章",
      tone: "primary",
      value: snapshot?.totalArticles ?? 0,
    },
    {
      icon: FilePenLine,
      label: "待完成草稿",
      tone: "warm",
      value: snapshot?.draftCount ?? 0,
    },
    {
      icon: MessageCircle,
      label: "今日评论",
      tone: "success",
      value: snapshot?.todayCommentCount ?? 0,
    },
    {
      icon: Sparkles,
      label: "Agent 待确认",
      tone: "neutral",
      value: snapshot?.pendingFindingCount ?? 0,
    },
  ] satisfies DashboardMetric[];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg bg-(--glass-surface) p-5 shadow-(--shadow-glass) backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">今日工作焦点</p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal">
            先处理待确认事项，再继续内容创作
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            汇总内容进度、互动治理和 Agent 建议，减少在模块之间来回查找。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={isLoading} variant="outline" onClick={() => void loadDashboard()}>
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            刷新
          </Button>
          <Button asChild>
            <Link to="/articles/new">
              <FilePenLine />
              写文章
            </Link>
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <div
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <section aria-label="运营指标" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardMetricCard isLoading={isLoading} key={metric.label} {...metric} />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-lg bg-(--glass-surface) shadow-(--shadow-glass) backdrop-blur-2xl">
          <SectionHeader
            actionLabel="查看全部"
            actionTo="/articles"
            description="最近更新的内容与发布状态"
            title="内容进度"
          />
          <div className="px-3 pb-3">
            {isLoading ? (
              <DashboardRowsSkeleton />
            ) : snapshot?.recentArticles.length ? (
              <div className="divide-y divide-border/45">
                {snapshot.recentArticles.map((article) => (
                  <article
                    className="grid gap-3 px-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    key={article.id}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          className="truncate text-sm font-medium transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
                          params={{ articleId: article.id }}
                          to="/articles/$articleId/edit"
                        >
                          {article.title}
                        </Link>
                        <ArticleStatusBadge status={article.status} />
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {article.category?.name ?? "未分类"} · {article.wordCount} 字 ·{" "}
                        {article.commentCount} 条评论
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={article.updatedAt}>
                      {formatRelativeDate(article.updatedAt)}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label="还没有文章，先创建第一篇内容。" />
            )}
          </div>
        </section>

        <section className="rounded-lg bg-(--glass-surface) shadow-(--shadow-glass) backdrop-blur-2xl">
          <SectionHeader description="需要留意或周期复核的项目" title="待办与风险" />
          <div className="grid gap-2 px-4 pb-4">
            <AttentionItem
              count={snapshot?.pendingFindingCount ?? 0}
              icon={Bot}
              label="Agent 建议待确认"
              loading={isLoading}
              tone="primary"
              to="/agent"
            />
            <AttentionItem
              count={snapshot?.draftCount ?? 0}
              icon={FilePenLine}
              label="草稿等待完成"
              loading={isLoading}
              tone="warm"
              to="/articles"
            />
            <AttentionItem
              count={snapshot?.hiddenCommentCount ?? 0}
              icon={MessageCircle}
              label="已隐藏评论待复核"
              loading={isLoading}
              tone="neutral"
              to="/comments"
            />
            <AttentionItem
              count={snapshot?.removedGuestbookCount ?? 0}
              icon={CircleAlert}
              label="软删除留言可恢复"
              loading={isLoading}
              tone="neutral"
              to="/guestbook"
            />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg bg-(--glass-surface) shadow-(--shadow-glass) backdrop-blur-2xl">
          <SectionHeader
            actionLabel="完整日志"
            actionTo="/audit"
            description="最近发生的后台写操作"
            title="最近动态"
          />
          <div className="px-3 pb-3">
            {isLoading ? (
              <DashboardRowsSkeleton rows={3} />
            ) : snapshot?.recentLogs.length ? (
              <div className="divide-y divide-border/45">
                {snapshot.recentLogs.map((log) => (
                  <div
                    className="grid gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    key={log.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{log.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground">@{log.actorLogin}</p>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={log.createdAt}>
                      {formatRelativeDate(log.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="暂无后台操作记录。" />
            )}
          </div>
        </section>

        <section className="rounded-lg bg-(--glass-surface) p-4 shadow-(--shadow-glass) backdrop-blur-2xl">
          <h2 className="text-sm font-semibold">快捷入口</h2>
          <div className="mt-3 grid gap-2">
            <QuickLink icon={Bot} label="打开 Agent 助手" to="/agent" />
            <QuickLink icon={MessageCircle} label="处理评论" to="/comments" />
            <QuickLink icon={Settings2} label="调整站点配置" to="/site" />
            <QuickLink icon={ShieldCheck} label="查看审计记录" to="/audit" />
          </div>
        </section>
      </div>
    </div>
  );
}

type DashboardMetric = {
  icon: LucideIcon;
  label: string;
  tone: keyof typeof metricToneStyles;
  value: number;
};

const metricToneStyles = {
  neutral: "bg-foreground/6 text-foreground",
  primary: "bg-primary/14 text-primary",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warm: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function DashboardMetricCard({
  icon: Icon,
  isLoading,
  label,
  tone,
  value,
}: DashboardMetric & {
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            metricToneStyles[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-0.5 text-2xl font-semibold tabular-nums",
              isLoading && "animate-pulse text-muted-foreground",
            )}
          >
            {isLoading ? "--" : value}
          </p>
        </div>
      </CardContent>
    </Card>
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
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
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
  tone,
  to,
}: {
  count: number;
  icon: LucideIcon;
  label: string;
  loading: boolean;
  tone: keyof typeof metricToneStyles;
  to: "/agent" | "/articles" | "/comments" | "/guestbook";
}) {
  return (
    <Link
      className="group flex min-h-12 items-center gap-3 rounded-lg bg-background/24 px-3 py-2.5 transition-colors hover:bg-background/45 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
      to={to}
    >
      <span
        className={cn("grid size-8 shrink-0 place-items-center rounded-md", metricToneStyles[tone])}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{loading ? "--" : count}</span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
  to: "/agent" | "/audit" | "/comments" | "/site";
}) {
  return (
    <Link
      className="group flex min-h-11 items-center gap-3 rounded-lg bg-background/24 px-3 text-sm transition-colors hover:bg-background/45 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
      to={to}
    >
      <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function DashboardRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2 py-1" aria-label="正在加载工作台数据" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="h-14 animate-pulse rounded-lg bg-muted/40" key={index} />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>;
}

function ArticleStatusBadge({ status }: { status: AdminArticleListItemResponse["status"] }) {
  if (status === "PUBLISHED") {
    return <Badge variant="success">已发布</Badge>;
  }

  if (status === "ARCHIVED") {
    return <Badge variant="outline">已归档</Badge>;
  }

  return <Badge variant="warning">草稿</Badge>;
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
