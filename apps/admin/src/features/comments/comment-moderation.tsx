import type {
  AdminArticleCommentListItemResponse,
  AdminArticleCommentListQuery,
  AdminArticleCommentStatus,
} from "@adrian-zephyr-notes/contracts";
import { Eye, EyeOff, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { Input } from "../../components/ui/input";
import {
  ManagementBody,
  ManagementEmpty,
  ManagementHeader,
  ManagementList,
  ManagementLoading,
  ManagementPagination,
  ManagementSurface,
  ManagementToolbar,
} from "../../components/ui/management-surface";
import { Select } from "../../components/ui/select";
import { listAdminArticleComments, updateAdminArticleComment } from "../../lib/admin-api";
import { cn } from "../../lib/utils";

const DEFAULT_PAGE_SIZE = 10;

type CommentModerationProps = {
  focusedCommentId?: string | null;
};

function CommentModeration({ focusedCommentId = null }: CommentModerationProps) {
  const [comments, setComments] = useState<AdminArticleCommentListItemResponse[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<AdminArticleCommentListQuery>({
    commentId: focusedCommentId ?? undefined,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    status: "ALL",
  });
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const isFocusedMode = Boolean(query.commentId);

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

  useEffect(() => {
    if (!focusedCommentId) {
      setQuery((current) =>
        current.commentId
          ? {
              page: 1,
              pageSize: DEFAULT_PAGE_SIZE,
              status: "ALL",
            }
          : current,
      );
      return;
    }

    setSearchText("");
    setQuery({
      commentId: focusedCommentId,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: "ALL",
    });
  }, [focusedCommentId]);

  async function updateCommentStatus(
    comment: AdminArticleCommentListItemResponse,
    status: AdminArticleCommentStatus,
  ) {
    if (status === "HIDDEN") {
      const confirmed = await confirm({
        confirmLabel: "隐藏评论",
        description: "隐藏后读者侧将不再展示这条评论。",
        title: "确认隐藏评论",
      });

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

  function submitSearch() {
    setQuery((current) => ({
      ...current,
      commentId: undefined,
      page: 1,
      q: searchText.trim() || undefined,
    }));
  }

  return (
    <ManagementSurface>
      <ManagementHeader
        description="在处理前先看文章、用户和回复上下文。"
        meta={<Badge variant="outline">{pagination.totalItems} 条</Badge>}
        title="评论治理"
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuery((current) => ({ ...current }))}
          >
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            刷新
          </Button>
        }
      />
      <ManagementBody>
        {errorMessage ? (
          <div
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}
        {isFocusedMode ? (
          <div
            className="flex flex-col gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <span>已定位到 Agent 风险卡片关联的评论。</span>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchText("");
                setQuery({
                  page: 1,
                  pageSize: DEFAULT_PAGE_SIZE,
                  status: "ALL",
                });
              }}
            >
              查看全部评论
            </Button>
          </div>
        ) : null}
        <ManagementToolbar className="md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索评论、作者、文章"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
            />
          </div>
          <Select
            value={query.status ?? "ALL"}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                commentId: undefined,
                page: 1,
                status: event.target.value as AdminArticleCommentListQuery["status"],
              }))
            }
          >
            <option value="ALL">全部状态</option>
            <option value="VISIBLE">可见</option>
            <option value="HIDDEN">已隐藏</option>
          </Select>
          <Button aria-label="搜索评论" title="搜索评论" type="button" onClick={submitSearch}>
            <Search />
            <span className="md:sr-only">搜索</span>
          </Button>
        </ManagementToolbar>
        <ManagementList>
          {isLoading ? <ManagementLoading label="正在加载评论..." /> : null}
          {comments.map((comment) => (
            <article
              key={comment.id}
              aria-current={comment.id === query.commentId ? "true" : undefined}
              className={cn(
                "p-4 transition-colors hover:bg-background/28",
                comment.id === query.commentId &&
                  "bg-primary/10 shadow-[inset_3px_0_0_color-mix(in_oklch,var(--primary)_65%,transparent)]",
              )}
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
                  <p className="text-sm/6 whitespace-pre-wrap">{comment.body}</p>
                  {comment.parent ? (
                    <div className="rounded-lg bg-muted/35 p-3">
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
            <ManagementEmpty label="没有符合条件的评论。" />
          ) : null}
        </ManagementList>
        <ManagementPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        />
      </ManagementBody>
      {confirmationDialog}
    </ManagementSurface>
  );
}

function StatusBadge({ status }: { status: AdminArticleCommentStatus }) {
  return (
    <Badge variant={status === "VISIBLE" ? "success" : "outline"}>
      {status === "VISIBLE" ? "可见" : "已隐藏"}
    </Badge>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { CommentModeration };
