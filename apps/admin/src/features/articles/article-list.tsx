import type {
  AdminArticleListItemResponse,
  AdminArticleStatus,
  AdminArticleAiSummaryStatus,
  ArticleOrigin,
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
}: {
  articles: AdminArticleListItemResponse[];
  isLoading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (isLoading)
    return (
      <div className="grid gap-2 py-3" role="status" aria-busy="true" aria-label="正在加载文章">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
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
      <div className="grid min-h-48 place-items-center py-10 text-center text-sm text-muted-foreground">
        <div className="grid justify-items-center gap-3">
          <FileText className="size-5" />
          <p>没有符合条件的文章</p>
        </div>
      </div>
    );
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1fr)_5rem_6rem_2.75rem] gap-4 border-b border-border px-1 py-3 text-xs text-muted-foreground lg:grid">
        <span>文章</span>
        <span>发布状态</span>
        <span>AI 摘要</span>
        <span className="text-right">操作</span>
      </div>
      <div className="divide-y divide-border">
        {articles.map((article) => (
          <article
            key={article.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-3 py-5 lg:grid-cols-[minmax(0,1fr)_5rem_6rem_2.75rem] lg:gap-4"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <ArticleListCover
                key={article.coverImageUrl ?? "empty"}
                src={article.coverImageUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <OriginBadge origin={article.origin} />
                  <span className="lg:hidden">
                    <StatusBadge status={article.status} />
                  </span>
                </div>
                <h2 className="line-clamp-2 text-base leading-6 font-semibold">
                  <Link
                    className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    to="/articles/$articleId/edit"
                    params={{ articleId: article.id }}
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {article.description || "尚未填写简介"}
                </p>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {new Date(article.updatedAt).toLocaleDateString("zh-CN")} · {article.slug}
                </p>
                <span className="mt-2 block lg:hidden">
                  <SummaryBadge status={article.aiSummaryStatus} />
                </span>
              </div>
            </div>
            <span className="hidden lg:block">
              <StatusBadge status={article.status} />
            </span>
            <span className="hidden lg:block">
              <SummaryBadge status={article.aiSummaryStatus} />
            </span>
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
        className="grid h-12 w-16 shrink-0 content-center justify-items-center gap-1 rounded-md bg-muted text-muted-foreground sm:h-14 sm:w-20"
      >
        <ImageIcon className="size-5" aria-hidden="true" />
        <span aria-hidden="true" className="text-[10px]">
          {failed ? "封面不可用" : "暂无封面"}
        </span>
      </span>
    );
  return (
    <img
      className="h-12 w-16 shrink-0 rounded-md bg-muted object-cover sm:h-14 sm:w-20"
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
export { ArticleList };
