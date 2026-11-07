import type {
  AdminArticleListItemResponse,
  AdminOperationLogResponse,
} from "@adrian-zephyr-notes/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FilePenLine, RefreshCw } from "lucide-react";
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
  featuredDraft: AdminArticleListItemResponse | null;
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
        featuredDraft:
          drafts.data[0] ?? articles.data.find((article) => article.status === "DRAFT") ?? null,
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

  const featured = snapshot?.featuredDraft;
  return (
    <div className="grid gap-8">
      <header>
        <p className="studio-kicker mb-4">01 / 创作总览</p>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h1 className="studio-title text-[clamp(2.25rem,4vw,4rem)]">今天，继续写下去。</h1>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://zephyrai.site"
              target="_blank"
              rel="noreferrer"
              className="mr-2 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              查看站点 ↗
            </a>
            <Button
              disabled={isLoading}
              variant="ghost"
              onClick={() => void loadDashboard()}
              aria-label={isLoading ? "刷新中" : "刷新"}
            >
              <RefreshCw className={cn(isLoading && "animate-spin motion-reduce:animate-none")} />
              <span className="sr-only">{isLoading ? "刷新中" : "刷新"}</span>
            </Button>
            <Button asChild size="lg">
              <Link to="/articles/new">
                <FilePenLine />
                写文章
              </Link>
            </Button>
          </div>
        </div>
      </header>
      {errorMessage ? (
        <p
          role="alert"
          className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm/6 text-destructive"
        >
          {errorMessage} 使用上方“刷新”重新读取。
        </p>
      ) : null}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,0.95fr)]">
        <div className="min-w-0">
          {!errorMessage ? (
            <section
              aria-label="继续创作"
              className="grid overflow-hidden bg-card/60 md:grid-cols-[1.1fr_1fr]"
            >
              <img
                src={featured?.coverImageUrl ?? "/images/editorial-stairway.webp"}
                alt={
                  featured?.coverImageUrl
                    ? `${featured.title}的文章封面`
                    : "阳光穿过石拱，照亮编辑室的阶梯"
                }
                className="h-52 w-full object-cover object-[center_58%] md:h-80"
              />
              <div className="flex min-w-0 flex-col items-start justify-center gap-5 p-6 sm:p-8">
                <span className="bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary">
                  {featured ? "继续创作" : "开始一篇新记录"}
                </span>
                {isLoading ? (
                  <div className="h-20 w-full animate-pulse bg-muted motion-reduce:animate-none" />
                ) : (
                  <>
                    <h2 className="font-display text-2xl/relaxed font-semibold text-pretty sm:text-3xl/relaxed">
                      {featured?.title ?? "把日常里的想法，整理成值得留下的文字。"}
                    </h2>
                    <p className="text-xs/6 text-muted-foreground">
                      {featured
                        ? `上次编辑：${formatRelativeDate(featured.updatedAt)}`
                        : "从一个问题、一段观察或一次实践开始。"}
                    </p>
                    <Button asChild variant="link" className="mt-2 h-auto px-0 text-sm">
                      {featured ? (
                        <Link to="/articles/$articleId/edit" params={{ articleId: featured.id }}>
                          继续编辑
                          <ArrowRight />
                        </Link>
                      ) : (
                        <Link to="/articles/new">
                          开始写作
                          <ArrowRight />
                        </Link>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </section>
          ) : null}
          {!errorMessage ? (
            <section aria-label="最近内容" className="mt-8 border-t border-border">
              <div className="flex items-center justify-between gap-3 py-4">
                <h2 className="font-display text-xl font-semibold">最近内容</h2>
                <Link
                  to="/articles"
                  className="rounded-sm text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  查看全部 ↗
                </Link>
              </div>
              {isLoading ? (
                <DashboardRowsSkeleton rows={3} />
              ) : snapshot?.recentArticles.length ? (
                <div className="divide-y divide-border border-y border-border">
                  {snapshot.recentArticles.slice(0, 3).map((article, index) => (
                    <article
                      key={article.id}
                      className="group grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-4 py-5 transition-colors hover:bg-primary/4 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
                    >
                      <span className="self-start pt-0.5 font-display text-lg text-primary tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        className="min-w-0 rounded-sm font-display text-lg/7 font-semibold wrap-anywhere hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        params={{ articleId: article.id }}
                        to="/articles/$articleId/edit"
                      >
                        {article.title}
                      </Link>
                      <div className="col-start-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:col-auto">
                        <span>{article.category?.name ?? "未分类"}</span>
                        <time dateTime={article.updatedAt}>
                          {formatRelativeDate(article.updatedAt)}
                        </time>
                        <ArticleStatusBadge status={article.status} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState label="还没有文章，先创建第一篇内容。" />
              )}
            </section>
          ) : null}
        </div>
        <aside className="min-w-0 border-t border-border pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">编辑手记</h2>
            <span className="text-xs text-primary">内容与互动</span>
          </div>
          <section aria-label="运营指标" aria-busy={isLoading}>
            <dl className="divide-y divide-border border-y border-border">
              {metrics.map(({ label, value }, index) => (
                <div key={label} className="flex items-center gap-4 py-4">
                  <dd className="min-w-8 font-display text-3xl text-primary tabular-nums">
                    {isLoading || errorMessage ? "—" : (value ?? "—")}
                  </dd>
                  <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
                  <Link
                    to={index < 2 ? "/articles" : index === 2 ? "/comments" : "/guestbook"}
                    aria-label={`查看${label}`}
                    className="rounded-sm p-1 text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ))}
            </dl>
          </section>
          {!errorMessage ? (
            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">最近动态</h2>
                <Link to="/audit" className="text-xs text-muted-foreground hover:text-primary">
                  完整日志 ↗
                </Link>
              </div>
              {isLoading ? (
                <DashboardRowsSkeleton rows={2} />
              ) : snapshot?.recentLogs.length ? (
                <div className="divide-y divide-border">
                  {snapshot.recentLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="py-3">
                      <p className="text-xs/6 wrap-anywhere">
                        {formatDashboardActivitySummary(log, snapshot.recentArticles)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        @{log.actorLogin} · {formatRelativeDate(log.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="暂无后台操作记录。" />
              )}
            </section>
          ) : null}
          <p className="mt-7 border-l-2 border-primary pl-4 font-display text-lg/8 text-muted-foreground italic">
            记录，是与时间保持联系。
          </p>
        </aside>
      </div>
    </div>
  );
}

function DashboardRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="正在加载工作台数据"
      aria-busy="true"
      className="grid gap-3 p-5 sm:p-6"
    >
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
  return <p className="px-5 py-12 text-center text-sm/6 text-muted-foreground">{label}</p>;
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
