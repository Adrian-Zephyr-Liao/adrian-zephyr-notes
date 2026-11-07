import type {
  AdminArticleListItemResponse,
  AdminArticleStatus,
  AdminArticleAiSummaryStatus,
} from "@adrian-zephyr-notes/contracts";
import { Link } from "@tanstack/react-router";
import { FileText, Image as ImageIcon, PencilLine } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

function ArticleList({
  articles,
  isLoading,
  failed,
  onRetry,
  startIndex = 0,
}: {
  articles: AdminArticleListItemResponse[];
  isLoading: boolean;
  failed: boolean;
  onRetry: () => void;
  startIndex?: number;
}) {
  if (isLoading)
    return (
      <div className="grid gap-3 py-5" role="status" aria-busy="true" aria-label="正在加载文章">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg bg-muted/65 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  if (failed)
    return (
      <div className="grid min-h-48 content-center justify-items-center gap-3 text-sm text-muted-foreground">
        <p>暂时无法读取文章，当前结果与统计不可用。</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          重试加载文章
        </Button>
      </div>
    );
  if (!articles.length)
    return (
      <div className="grid min-h-72 place-items-center px-5 py-14 text-center text-sm text-muted-foreground">
        <div className="grid justify-items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-muted">
            <FileText className="size-5" />
          </span>
          <p>没有符合条件的文章</p>
        </div>
      </div>
    );
  return (
    <div>
      <div className="hidden grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_4.5rem_6rem_2.5rem] items-center gap-4 border-b border-border py-4 text-xs text-muted-foreground xl:grid">
        <span>序</span>
        <span>标题与摘要</span>
        <span>分类</span>
        <span>标签</span>
        <span>状态</span>
        <span>更新日期</span>
        <span className="sr-only">操作</span>
      </div>
      <div className="divide-y divide-border">
        {articles.map((article, index) => (
          <article
            key={article.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 py-4 transition-colors hover:bg-muted/25 motion-reduce:transition-none xl:grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_4.5rem_6rem_2.5rem] xl:gap-4"
          >
            <span className="hidden self-start pt-1 font-display text-xs text-muted-foreground tabular-nums xl:block">
              {String(startIndex + index + 1).padStart(2, "0")}
            </span>
            <div className="flex min-w-0 items-start gap-4">
              <ArticleListCover
                key={article.coverImageUrl ?? "empty"}
                src={article.coverImageUrl}
              />
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-display text-lg/snug font-medium">
                  <Link
                    className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    to="/articles/$articleId/edit"
                    params={{ articleId: article.id }}
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-2 text-xs/5 text-muted-foreground">
                  {article.description || "尚未填写简介"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{article.origin === "REPOSTED" ? "转载" : "原创"}</span>
                  <span aria-hidden="true">·</span>
                  <SummaryBadge status={article.aiSummaryStatus} />
                  <span className="xl:hidden">· {article.category?.name ?? "未分类"}</span>
                  <span className="xl:hidden">
                    · {new Date(article.updatedAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="xl:hidden">
                    <StatusBadge status={article.status} />
                  </span>
                </div>
              </div>
            </div>
            <span className="hidden font-display text-sm text-muted-foreground xl:block">
              {article.category?.name ?? "未分类"}
            </span>
            <div className="hidden flex-wrap gap-1.5 xl:flex">
              {article.tags.length ? (
                article.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.slug}
                    className="bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <span className="hidden xl:block">
              <StatusBadge status={article.status} />
            </span>
            <time
              dateTime={article.updatedAt}
              className="hidden font-display text-xs text-muted-foreground tabular-nums xl:block"
            >
              {formatArchiveDate(article.updatedAt)}
            </time>
            <Button asChild size="icon" variant="ghost">
              <Link
                aria-label={`编辑 ${article.title}`}
                title={`编辑 ${article.title}`}
                to="/articles/$articleId/edit"
                params={{ articleId: article.id }}
              >
                <PencilLine />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
function ArticleListCover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <span
        role="img"
        aria-label={failed ? "封面不可用" : "暂无封面"}
        className="grid h-16 w-20 shrink-0 content-center justify-items-center gap-1 rounded-sm bg-muted text-muted-foreground sm:h-18 sm:w-26"
      >
        <ImageIcon className="size-5" aria-hidden="true" />
        <span aria-hidden="true" className="text-[10px]">
          {failed ? "封面不可用" : "暂无封面"}
        </span>
      </span>
    );
  return (
    <img
      className="h-16 w-20 shrink-0 rounded-sm bg-muted object-cover sm:h-18 sm:w-26"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
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
function formatArchiveDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
const articleStatusMeta: Record<
  AdminArticleStatus,
  { label: string; variant: "outline" | "success" | "warning" }
> = {
  ARCHIVED: { label: "归档", variant: "outline" },
  DRAFT: { label: "草稿", variant: "warning" },
  PUBLISHED: { label: "已发布", variant: "success" },
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
export { ArticleList };
