import { Link } from "@tanstack/react-router";
import type {
  AdminArticleAiSummaryStatus,
  AdminArticleListItemResponse,
  AdminArticleListQuery,
  ArticleOrigin,
  AdminArticleStatus,
} from "@adrian-zephyr-notes/contracts";
import { FilePlus2, FolderTree, PencilLine, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="grid w-full min-w-0 gap-4">
      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="总数" value={pageStats.totalArticles} />
        <MetricCard label="本页已发布" value={pageStats.publishedOnPage} />
        <MetricCard label="本页原创" value={pageStats.originalOnPage} />
        <MetricCard label="本页转载" value={pageStats.repostedOnPage} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>文章管理</CardTitle>
              <CardDescription>筛选文章并进入全屏写作页。</CardDescription>
            </div>
            <div className="flex gap-2">
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
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="搜索标题 / slug"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitSearch();
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 lg:w-auto lg:grid-cols-[160px_160px_auto_auto]">
              <Select
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
              <Select
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
              <Button type="button" variant="outline" onClick={submitSearch}>
                搜索
              </Button>
              <Button
                aria-label="刷新文章"
                size="icon"
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
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border border-border/70 bg-muted/50"
          />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        没有符合条件的文章。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_140px_120px] gap-3 border-b border-border/70 bg-muted/45 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
        <span>标题</span>
        <span>发布状态</span>
        <span>AI 摘要</span>
        <span className="text-right">操作</span>
      </div>
      <div className="divide-y divide-border/70">
        {articles.map((article) => (
          <article
            key={article.id}
            className="grid gap-3 bg-background/55 px-4 py-3 transition-colors hover:bg-muted/45 lg:grid-cols-[minmax(0,1.4fr)_120px_140px_120px] lg:items-center"
          >
            <div className="min-w-0">
              <div className="mb-1 flex items-start justify-between gap-2 lg:block">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="line-clamp-1 text-sm font-medium">{article.title}</h3>
                  <OriginBadge origin={article.origin} />
                </div>
                <span className="lg:hidden">
                  <StatusBadge status={article.status} />
                </span>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">{article.description}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{article.slug}</p>
            </div>
            <span className="hidden lg:block">
              <StatusBadge status={article.status} />
            </span>
            <span>
              <SummaryBadge status={article.aiSummaryStatus} />
            </span>
            <div className="flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link params={{ articleId: article.id }} to="/articles/$articleId/edit">
                  <PencilLine />
                  编辑
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
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          disabled={page >= normalizedTotalPages}
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
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
