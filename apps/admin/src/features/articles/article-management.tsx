import { Link } from "@tanstack/react-router";
import type {
  AdminArticleAiSummaryStatus,
  AdminArticleListItemResponse,
  AdminArticleListQuery,
  ArticleOrigin,
  AdminArticleStatus,
} from "@adrian-zephyr-notes/contracts";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderTree,
  PenTool,
  PencilLine,
  RefreshCw,
  Repeat2,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { listAdminArticles } from "../../lib/admin-api";
import { cn } from "../../lib/utils";

const DEFAULT_PAGE_SIZE = 12;

function ArticleManagement() {
  const [articles, setArticles] = useState<AdminArticleListItemResponse[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<AdminArticleListQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    status: "ALL",
  });
  const [searchText, setSearchText] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadArticles = useCallback(async (nextQuery: AdminArticleListQuery) => {
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      const response = await listAdminArticles(nextQuery);

      setArticles(response.data);
      setPagination(response.pagination);
    } catch {
      setErrorMessage("文章列表加载失败，请检查服务端或管理员权限配置。");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadArticles(query);
  }, [loadArticles, query]);

  const pageStats = useMemo(
    () => createArticleStats(articles, pagination.totalItems),
    [articles, pagination.totalItems],
  );

  function submitSearch() {
    setQuery((current) => ({
      ...current,
      page: 1,
      q: searchText.trim() || undefined,
    }));
  }

  return (
    <div className="grid w-full min-w-0 gap-5">
      {errorMessage ? (
        <div
          className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive backdrop-blur-md"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FileText}
          label="全部文章"
          tone="primary"
          value={pageStats.totalArticles}
        />
        <MetricCard
          icon={CheckCircle2}
          label="本页已发布"
          tone="success"
          value={pageStats.publishedOnPage}
        />
        <MetricCard
          icon={PenTool}
          label="本页原创"
          tone="neutral"
          value={pageStats.originalOnPage}
        />
        <MetricCard icon={Repeat2} label="本页转载" tone="warm" value={pageStats.repostedOnPage} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-(--glass-border) bg-background/14 dark:border-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>文章管理</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/articles/categories">
                  <FolderTree />
                  分类管理
                </Link>
              </Button>
              <Button asChild>
                <Link to="/articles/new">
                  <FilePlus2 />
                  新建文章
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-5">
          <div className="grid gap-3 rounded-lg border border-(--glass-border) bg-background/18 p-3 backdrop-blur-md xl:grid-cols-[minmax(280px,1fr)_176px_176px_auto] xl:items-end dark:border-transparent">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              <span>搜索文章</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="搜索文章"
                  className="pl-9"
                  placeholder="标题或 slug"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitSearch();
                    }
                  }}
                />
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>发布状态</span>
              <Select
                aria-label="发布状态"
                value={query.status ?? "ALL"}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    status: event.target.value as AdminArticleListQuery["status"],
                  }))
                }
              >
                <option value="ALL">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="PUBLISHED">已发布</option>
                <option value="ARCHIVED">已归档</option>
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>文章来源</span>
              <Select
                aria-label="文章来源"
                value={query.origin ?? "ALL"}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    origin: event.target.value as AdminArticleListQuery["origin"],
                    page: 1,
                  }))
                }
              >
                <option value="ALL">全部来源</option>
                <option value="ORIGINAL">原创</option>
                <option value="REPOSTED">转载</option>
              </Select>
            </label>
            <div className="flex gap-2">
              <Button className="flex-1 xl:flex-none" type="button" onClick={submitSearch}>
                <Search />
                筛选
              </Button>
              <Button
                aria-label="刷新文章"
                disabled={isLoadingList}
                size="icon"
                title="刷新文章"
                type="button"
                variant="outline"
                onClick={() => void loadArticles(query)}
              >
                <RefreshCw className={cn(isLoadingList && "animate-spin")} />
              </Button>
            </div>
          </div>
          <ArticleList articles={articles} isLoading={isLoadingList} />
          <ArticlePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleList({
  articles,
  isLoading,
}: {
  articles: AdminArticleListItemResponse[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="正在加载文章">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border border-(--glass-border) bg-muted/45 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border bg-background/18 p-8 text-center text-sm text-muted-foreground">
        <div className="grid justify-items-center gap-2">
          <FileText className="size-5" />
          <p>没有符合条件的文章</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-(--glass-border) bg-background/16 backdrop-blur-md">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_140px_64px] gap-3 border-b border-(--glass-border) bg-background/28 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
        <span>标题</span>
        <span>发布状态</span>
        <span>AI 摘要</span>
        <span className="text-right">操作</span>
      </div>
      <div className="divide-y divide-border/55">
        {articles.map((article) => (
          <article
            key={article.id}
            className="grid gap-3 bg-background/20 px-4 py-3.5 transition-colors duration-200 hover:bg-background/45 lg:grid-cols-[minmax(0,1.4fr)_120px_140px_64px] lg:items-center"
          >
            <div className="min-w-0">
              <div className="mb-1 flex items-start justify-between gap-2 lg:block">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="line-clamp-1 text-sm font-medium">
                    <Link
                      className="rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/45"
                      params={{ articleId: article.id }}
                      to="/articles/$articleId/edit"
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <OriginBadge origin={article.origin} />
                </div>
                <span className="lg:hidden">
                  <StatusBadge status={article.status} />
                </span>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">{article.description}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/85">
                {article.slug}
              </p>
            </div>
            <span className="hidden lg:block">
              <StatusBadge status={article.status} />
            </span>
            <span>
              <SummaryBadge status={article.aiSummaryStatus} />
            </span>
            <div className="flex justify-end">
              <Button asChild size="icon" variant="ghost">
                <Link
                  aria-label={`编辑 ${article.title}`}
                  params={{ articleId: article.id }}
                  title={`编辑 ${article.title}`}
                  to="/articles/$articleId/edit"
                >
                  <PencilLine />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArticlePagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const normalizedTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {normalizedTotalPages} 页
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          aria-label="上一页"
          size="icon"
          title="上一页"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          disabled={page >= normalizedTotalPages}
          aria-label="下一页"
          size="icon"
          title="下一页"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

const metricToneStyles = {
  neutral: "bg-foreground/6 text-foreground",
  primary: "bg-primary/14 text-primary",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warm: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
} satisfies Record<string, string>;

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: keyof typeof metricToneStyles;
  value: number;
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
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AdminArticleStatus }) {
  const meta = articleStatusMeta[status];

  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function SummaryBadge({ status }: { status: AdminArticleAiSummaryStatus }) {
  const meta = summaryStatusMeta[status];

  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function OriginBadge({ origin }: { origin: ArticleOrigin }) {
  return (
    <Badge variant={origin === "REPOSTED" ? "warning" : "outline"}>
      {origin === "REPOSTED" ? "转载" : "原创"}
    </Badge>
  );
}

const articleStatusMeta: Record<
  AdminArticleStatus,
  { label: string; variant: "outline" | "success" | "warning" }
> = {
  ARCHIVED: { label: "归档", variant: "outline" },
  DRAFT: { label: "草稿", variant: "warning" },
  PUBLISHED: { label: "发布", variant: "success" },
};

const summaryStatusMeta: Record<
  AdminArticleAiSummaryStatus,
  { label: string; variant: "destructive" | "outline" | "success" | "warning" }
> = {
  FAILED: { label: "摘要失败", variant: "destructive" },
  GENERATING: { label: "生成中", variant: "warning" },
  PENDING: { label: "待摘要", variant: "warning" },
  READY: { label: "已摘要", variant: "success" },
  UNQUEUED: { label: "未排队", variant: "outline" },
};

function createArticleStats(articles: AdminArticleListItemResponse[], totalItems: number) {
  return {
    totalArticles: totalItems,
    publishedOnPage: articles.filter((article) => article.status === "PUBLISHED").length,
    originalOnPage: articles.filter((article) => article.origin === "ORIGINAL").length,
    repostedOnPage: articles.filter((article) => article.origin === "REPOSTED").length,
  };
}

export { ArticleManagement };
