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
  ManagementEmpty,
  ManagementLoading,
  ManagementPagination,
} from "../../components/ui/management-surface";
import { ReaderAvatar, ReaderInbox, ReaderInboxItem, ReaderRelatedLink } from "./reader-inbox";
import { Select } from "../../components/ui/select";
import { listAdminArticleComments, updateAdminArticleComment } from "../../lib/admin-api";
import { useModerationList } from "../moderation/use-moderation-list";

const DEFAULT_PAGE_SIZE = 10;

type CommentModerationProps = {
  focusedCommentId?: string | null;
};

function CommentModeration({ focusedCommentId = null }: CommentModerationProps) {
  const {
    query,
    setQuery,
    items: comments,
    pagination,
    isLoading,
    isReady,
    errorMessage,
    updatingId: updatingCommentId,
    mutate,
    resultsRef,
    statusMessage,
  } = useModerationList<AdminArticleCommentListQuery, AdminArticleCommentListItemResponse>({
    initialQuery: {
      commentId: focusedCommentId ?? undefined,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: "ALL",
    },
    list: listAdminArticleComments,
    loadError: "评论列表加载失败，请检查服务端或管理员权限配置。",
    updateError: "评论状态更新失败，请稍后重试。",
  });
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    comments.find((comment) => comment.id === (selectedId ?? query.commentId)) ?? comments[0];
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const isFocusedMode = Boolean(query.commentId);

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
    setSelectedId(null);
    setQuery({
      commentId: focusedCommentId,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: "ALL",
    });
  }, [focusedCommentId, setQuery]);

  async function updateCommentStatus(
    comment: AdminArticleCommentListItemResponse,
    status: AdminArticleCommentStatus,
  ) {
    await mutate(
      comment.id,
      () => updateAdminArticleComment(comment.id, { status }),
      status === "HIDDEN"
        ? () =>
            confirm({
              confirmLabel: "隐藏评论",
              description: "隐藏后读者侧将不再展示这条评论。",
              title: "确认隐藏评论",
            })
        : undefined,
    );
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
    <section
      ref={resultsRef}
      aria-label="审核结果"
      aria-busy={isLoading}
      tabIndex={-1}
      className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {errorMessage ? (
        <p
          role="alert"
          className="mb-5 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm/6 text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
      {isFocusedMode ? (
        <div
          role="status"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-sm text-primary"
        >
          <span>已定位到指定评论。</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchText("");
              setQuery({ page: 1, pageSize: DEFAULT_PAGE_SIZE, status: "ALL" });
            }}
          >
            查看全部评论
          </Button>
        </div>
      ) : null}
      <ReaderInbox
        kind="comments"
        loading={isLoading}
        total={pagination?.totalItems}
        toolbar={
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索评论内容"
                className="pl-9"
                placeholder="搜索评论、作者、文章"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
              />
            </div>
            <Button
              aria-label="搜索评论"
              type="button"
              size="icon"
              variant="outline"
              onClick={submitSearch}
            >
              <Search />
            </Button>
            <Select
              aria-label="评论状态"
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
            <Button
              aria-label="刷新"
              variant="ghost"
              size="icon"
              onClick={() => setQuery((current) => ({ ...current }))}
            >
              <RefreshCw
                className={isLoading ? "animate-spin motion-reduce:animate-none" : undefined}
              />
            </Button>
          </div>
        }
        pagination={
          pagination ? (
            <ManagementPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
            />
          ) : null
        }
        detail={
          selected ? (
            <article data-moderation-id={selected.id} className="grid gap-6">
              <header className="flex items-start gap-4">
                <ReaderAvatar
                  large
                  name={selected.author.name ?? selected.author.login}
                  src={selected.author.avatarUrl}
                />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold wrap-anywhere">
                    {selected.author.name ?? selected.author.login}
                  </h2>
                  <a
                    className="mt-1 block text-xs text-muted-foreground hover:text-primary hover:underline"
                    href={selected.author.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{selected.author.login}
                  </a>
                  <p className="mt-2 text-xs/6 text-muted-foreground">
                    {formatDateTime(selected.createdAt)} · 文章评论
                  </p>
                </div>
              </header>
              <ReaderRelatedLink
                href={`/articles/${encodeURIComponent(selected.article.id)}/edit`}
                label={`相关文章 · ${selected.article.title}`}
              />
              <p className="min-h-24 text-base/8 wrap-anywhere whitespace-pre-wrap">
                {selected.body}
              </p>
              {selected.parent ? (
                <section className="border-t border-border pt-5">
                  <p className="mb-3 text-xs text-muted-foreground">
                    回复上下文 · @{selected.parent.author.login}
                  </p>
                  <p className="border-l-2 border-primary/35 pl-5 text-sm/7 wrap-anywhere whitespace-pre-wrap">
                    {selected.parent.body}
                  </p>
                </section>
              ) : null}
              <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {selected.likeCount} 赞 · {selected.replyCount} 条回复
                  </span>
                </div>
                <Button
                  data-moderation-action="visibility"
                  disabled={updatingCommentId !== null}
                  type="button"
                  variant={selected.status === "VISIBLE" ? "outline" : "default"}
                  onClick={() =>
                    void updateCommentStatus(
                      selected,
                      selected.status === "VISIBLE" ? "HIDDEN" : "VISIBLE",
                    )
                  }
                >
                  {updatingCommentId === selected.id ? (
                    <Loader2 className="animate-spin motion-reduce:animate-none" />
                  ) : selected.status === "VISIBLE" ? (
                    <EyeOff />
                  ) : (
                    <Eye />
                  )}
                  {updatingCommentId === selected.id
                    ? "处理中"
                    : selected.status === "VISIBLE"
                      ? "隐藏"
                      : "恢复"}
                </Button>
              </footer>
            </article>
          ) : (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              {isLoading ? "正在读取来信" : "选择一条来信，阅读完整内容与上下文。"}
            </div>
          )
        }
      >
        {isLoading ? <ManagementLoading label="正在加载评论..." /> : null}
        {comments.map((comment, index) => (
          <ReaderInboxItem
            key={comment.id}
            active={selected?.id === comment.id}
            author={comment.author.name ?? comment.author.login}
            avatar={comment.author.avatarUrl}
            body={comment.body}
            context={`文章 · ${comment.article.title}`}
            date={formatShortDate(comment.createdAt)}
            index={index}
            onSelect={() => setSelectedId(comment.id)}
          />
        ))}
        {isReady && comments.length === 0 ? <ManagementEmpty label="没有符合条件的评论。" /> : null}
      </ReaderInbox>
      <span role="status" className="sr-only">
        {statusMessage}
      </span>
      {confirmationDialog}
    </section>
  );
}

function StatusBadge({ status }: { status: AdminArticleCommentStatus }) {
  return (
    <Badge variant={status === "VISIBLE" ? "success" : "outline"}>
      {status === "VISIBLE" ? "可见" : "已隐藏"}
    </Badge>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { CommentModeration };
