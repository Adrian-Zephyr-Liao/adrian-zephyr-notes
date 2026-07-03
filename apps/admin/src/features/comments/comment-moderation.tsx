import type {
  AdminArticleCommentListItemResponse,
  AdminArticleCommentListQuery,
  AdminArticleCommentStatus,
} from "@adrian-zephyr-notes/contracts";
import { Eye, EyeOff, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
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
import { listAdminArticleComments, updateAdminArticleComment } from "../../lib/admin-api";
import { cn } from "../../lib/utils";

const DEFAULT_PAGE_SIZE = 10;

function CommentModeration() {
  const [comments, setComments] = useState<AdminArticleCommentListItemResponse[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<AdminArticleCommentListQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    status: "ALL",
  });
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    void listAdminArticleComments(query)
      .then((response) => {
        setComments(response.data);
        setPagination(response.pagination);
      })
      .catch(() => setErrorMessage("评论列表加载失败，请检查服务端或管理员权限配置。"))
      .finally(() => setIsLoading(false));
  }, [query]);

  async function updateCommentStatus(
    comment: AdminArticleCommentListItemResponse,
    status: AdminArticleCommentStatus,
  ) {
    if (status === "HIDDEN") {
      const confirmed = window.confirm("隐藏这条评论？读者侧将不再展示。");

      if (!confirmed) {
        return;
      }
    }

    setUpdatingCommentId(comment.id);

    try {
      const updated = await updateAdminArticleComment(comment.id, { status });
      setComments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setErrorMessage("评论状态更新失败，请稍后重试。");
    } finally {
      setUpdatingCommentId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>评论治理</CardTitle>
            <CardDescription>在处理前先看文章、用户和回复上下文。</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuery((current) => ({ ...current }))}
          >
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索评论、作者、文章"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    q: searchText.trim() || undefined,
                  }));
                }
              }}
            />
          </div>
          <Select
            value={query.status ?? "ALL"}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                page: 1,
                status: event.target.value as AdminArticleCommentListQuery["status"],
              }))
            }
          >
            <option value="ALL">全部状态</option>
            <option value="VISIBLE">可见</option>
            <option value="HIDDEN">已隐藏</option>
          </Select>
        </div>
        <div className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载评论...
            </div>
          ) : null}
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-xl border border-border/70 bg-background/65 p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={comment.status} />
                    <Badge variant="outline">{comment.article.title}</Badge>
                    {comment.parent ? (
                      <Badge variant="default">回复 @{comment.parent.author.login}</Badge>
                    ) : null}
                    {comment.replyCount > 0 ? (
                      <Badge variant="secondary">{comment.replyCount} 条回复</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 whitespace-pre-wrap">{comment.body}</p>
                  {comment.parent ? (
                    <div className="rounded-lg border border-border/70 bg-muted/45 p-3">
                      <p className="text-xs text-muted-foreground">
                        回复上下文 · @{comment.parent.author.login}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm">{comment.parent.body}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{comment.likeCount} 赞</span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="flex items-center gap-2 lg:flex-row-reverse">
                    {comment.author.avatarUrl ? (
                      <img
                        alt={comment.author.login}
                        className="size-9 rounded-full ring-1 ring-border"
                        src={comment.author.avatarUrl}
                      />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {comment.author.login.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 lg:text-right">
                      <p className="truncate text-sm font-medium">
                        {comment.author.name ?? comment.author.login}
                      </p>
                      <a
                        className="text-xs text-primary hover:underline"
                        href={comment.author.profileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        @{comment.author.login}
                      </a>
                    </div>
                  </div>
                  {comment.status === "VISIBLE" ? (
                    <Button
                      disabled={updatingCommentId === comment.id}
                      type="button"
                      variant="outline"
                      onClick={() => void updateCommentStatus(comment, "HIDDEN")}
                    >
                      {updatingCommentId === comment.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <EyeOff />
                      )}
                      隐藏
                    </Button>
                  ) : (
                    <Button
                      disabled={updatingCommentId === comment.id}
                      type="button"
                      onClick={() => void updateCommentStatus(comment, "VISIBLE")}
                    >
                      {updatingCommentId === comment.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Eye />
                      )}
                      恢复
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!isLoading && comments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              没有符合条件的评论。
            </div>
          ) : null}
        </div>
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AdminArticleCommentStatus }) {
  return (
    <Badge variant={status === "VISIBLE" ? "success" : "outline"}>
      {status === "VISIBLE" ? "可见" : "已隐藏"}
    </Badge>
  );
}

function PaginationControls({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {Math.max(totalPages, 1)} 页
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
          disabled={page >= totalPages}
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { CommentModeration };
