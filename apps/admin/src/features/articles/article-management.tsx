import { Link } from "@tanstack/react-router";
import type {
  AdminArticleListItemResponse,
  AdminArticleListQuery,
} from "@adrian-zephyr-notes/contracts";
import { FilePlus2, FolderTree, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { listAdminArticles } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import { ManagementPagination } from "../../components/ui/management-surface";
import { ArticleList } from "./article-list";

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
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestRequest = useRef<symbol | null>(null);

  useEffect(
    () => () => {
      latestRequest.current = null;
    },
    [],
  );

  const loadArticles = useCallback(async (nextQuery: AdminArticleListQuery) => {
    const requestId = Symbol("article-list-request");
    latestRequest.current = requestId;
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      const response = await listAdminArticles(nextQuery);
      if (latestRequest.current !== requestId) return;

      setArticles(response.data);
      setPagination(response.pagination);
    } catch {
      if (latestRequest.current === requestId)
        setErrorMessage("文章列表加载失败，请检查服务端或管理员权限配置。");
    } finally {
      if (latestRequest.current === requestId) setIsLoadingList(false);
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
          className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <dl aria-label="文章统计" className="flex flex-wrap gap-x-7 gap-y-3">
          {[
            { label: "全部文章", value: pageStats.totalArticles },
            { label: "本页已发布", value: pageStats.publishedOnPage },
            { label: "本页原创", value: pageStats.originalOnPage },
            { label: "本页转载", value: pageStats.repostedOnPage },
          ].map((item) => (
            <div className="flex items-baseline gap-2" key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {isLoadingList || errorMessage ? "—" : item.value}
              </dd>
            </div>
          ))}
        </dl>
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
      <section className="min-w-0" aria-label="文章检索与结果">
        <div className="grid gap-3 border-b border-border pb-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_auto] xl:items-end">
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
        <ArticleList
          articles={articles}
          isLoading={isLoadingList}
          failed={Boolean(errorMessage)}
          onRetry={() => void loadArticles(query)}
        />
        {!isLoadingList && !errorMessage ? (
          <ManagementPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        ) : null}
      </section>
    </div>
  );
}

function createArticleStats(articles: AdminArticleListItemResponse[], totalItems: number) {
  return {
    totalArticles: totalItems,
    publishedOnPage: articles.filter((article) => article.status === "PUBLISHED").length,
    originalOnPage: articles.filter((article) => article.origin === "ORIGINAL").length,
    repostedOnPage: articles.filter((article) => article.origin === "REPOSTED").length,
  };
}

export { ArticleManagement };
