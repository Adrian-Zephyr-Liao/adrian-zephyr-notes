import { Link } from "@tanstack/react-router";
import type {
  AdminArticleListItemResponse,
  AdminArticleListQuery,
} from "@adrian-zephyr-notes/contracts";
import { FilePlus2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { listAdminArticles } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import { ManagementPagination } from "../../components/ui/management-surface";
import { ArticleList } from "./article-list";
import { ArticleArchiveHeading, ArticleArchiveLayout } from "./article-archive-layout";

const DEFAULT_PAGE_SIZE = 12;

function ArticleManagement({
  searchQuery = "",
  onSearchSubmit,
}: { searchQuery?: string; onSearchSubmit?: (query: string) => void } = {}) {
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
    q: searchQuery.trim() || undefined,
  });
  const [searchText, setSearchText] = useState(searchQuery);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestRequest = useRef<symbol | null>(null);

  useEffect(() => {
    const q = searchQuery.trim() || undefined;
    setSearchText(searchQuery);
    setQuery((current) => (current.q === q ? current : { ...current, page: 1, q }));
  }, [searchQuery]);

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
    const q = searchText.trim();
    onSearchSubmit?.(q);
    setQuery((current) => ({
      ...current,
      page: 1,
      q: q || undefined,
    }));
  }

  return (
    <ArticleArchiveLayout page="articles">
      <ArticleArchiveHeading
        title="内容档案"
        subtitle="A LIVING INDEX"
        meta={
          <span className="hidden font-display text-sm whitespace-nowrap text-muted-foreground sm:block">
            共 {isLoadingList || errorMessage ? "—" : pagination.totalItems} 篇记录
          </span>
        }
        action={
          <Button asChild>
            <Link to="/articles/new">
              <FilePlus2 />
              新建文章
            </Link>
          </Button>
        }
      />
      {errorMessage ? (
        <div
          className="mb-5 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}
      <section className="min-w-0" aria-label="文章检索与结果">
        <div className="grid gap-4 border-b border-border pb-4 xl:flex xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-5">
          <div className="flex gap-5 overflow-x-auto" role="group" aria-label="按发布状态筛选">
            {(
              [
                { value: "ALL", label: "全部" },
                { value: "PUBLISHED", label: "已发布" },
                { value: "DRAFT", label: "草稿" },
                { value: "ARCHIVED", label: "归档" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={(query.status ?? "ALL") === item.value}
                onClick={() => setQuery((current) => ({ ...current, page: 1, status: item.value }))}
                className={cn(
                  "min-h-11 shrink-0 cursor-pointer border-b-2 border-transparent px-1 pb-2 font-display text-base text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                  (query.status ?? "ALL") === item.value && "border-primary text-primary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid w-full grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_2.5rem_2.5rem] xl:flex xl:w-auto xl:max-w-xl xl:min-w-0 xl:flex-1 xl:flex-wrap xl:items-center xl:justify-end">
            <label className="relative col-span-3 min-w-0 sm:col-span-1 xl:min-w-44 xl:flex-1">
              <span className="sr-only">搜索文章</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索文章"
                className="pl-9"
                placeholder="搜索标题或 slug…"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
              />
            </label>
            <label className="min-w-0 xl:w-32 xl:shrink-0">
              <span className="sr-only">文章来源</span>
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
            <Button
              aria-label="筛选文章"
              type="button"
              variant="outline"
              size="icon"
              onClick={submitSearch}
            >
              <Search />
            </Button>
            <Button
              aria-label="刷新文章"
              disabled={isLoadingList}
              size="icon"
              title="刷新文章"
              type="button"
              variant="ghost"
              onClick={() => void loadArticles(query)}
            >
              <RefreshCw
                className={cn(isLoadingList && "animate-spin motion-reduce:animate-none")}
              />
            </Button>
          </div>
        </div>
        <ArticleList
          articles={articles}
          isLoading={isLoadingList}
          failed={Boolean(errorMessage)}
          onRetry={() => void loadArticles(query)}
          startIndex={(pagination.page - 1) * pagination.pageSize}
        />
        {!isLoadingList && !errorMessage ? (
          <ManagementPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        ) : null}
      </section>
      <dl
        aria-label="文章统计"
        className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-8"
      >
        {[
          { label: "匹配文章", value: pageStats.totalArticles },
          { label: "本页已发布", value: pageStats.publishedOnPage },
          { label: "本页原创", value: pageStats.originalOnPage },
          { label: "本页转载", value: pageStats.repostedOnPage },
        ].map((item) => (
          <div className="flex items-baseline gap-2" key={item.label}>
            <dt>{item.label}</dt>
            <dd className="font-display text-base text-foreground tabular-nums">
              {isLoadingList || errorMessage ? "—" : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </ArticleArchiveLayout>
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
