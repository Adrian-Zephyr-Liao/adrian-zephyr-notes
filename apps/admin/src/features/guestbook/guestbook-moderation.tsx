import type {
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesQuery,
  AdminGuestbookMessageStatus,
} from "@adrian-zephyr-notes/contracts";
import { Eye, EyeOff, Pin, PinOff, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { Input } from "../../components/ui/input";
import {
  ManagementEmpty,
  ManagementLoading,
  ManagementPagination,
} from "../../components/ui/management-surface";
import {
  ReaderAvatar,
  ReaderInbox,
  ReaderInboxItem,
  ReaderRelatedLink,
} from "../comments/reader-inbox";
import { Select } from "../../components/ui/select";
import { listAdminGuestbookMessages, updateAdminGuestbookMessage } from "../../lib/admin-api";
import { useModerationList } from "../moderation/use-moderation-list";

const DEFAULT_PAGE_SIZE = 10;

function GuestbookModeration() {
  const {
    query,
    setQuery,
    items: messages,
    pagination,
    isLoading,
    isReady,
    errorMessage,
    updatingId: updatingMessageId,
    mutate,
    resultsRef,
    statusMessage,
  } = useModerationList<AdminGuestbookMessagesQuery, AdminGuestbookMessageListItemResponse>({
    initialQuery: {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: "ALL",
    },
    list: listAdminGuestbookMessages,
    loadError: "留言列表加载失败，请检查服务端或管理员权限配置。",
    updateError: "留言状态更新失败，请稍后重试。",
  });
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];
  const author = selected ? getAuthor(selected) : null;
  const { confirm, confirmationDialog } = useConfirmationDialog();

  async function updateMessage(
    message: AdminGuestbookMessageListItemResponse,
    input: { isPinned?: boolean; status?: AdminGuestbookMessageStatus },
  ) {
    await mutate(
      message.id,
      () => updateAdminGuestbookMessage(message.id, input),
      input.status === "DELETED"
        ? () =>
            confirm({
              confirmLabel: "删除留言",
              description: "删除后读者侧不再展示，但仍可在已删除状态中恢复。",
              title: "确认删除留言",
              variant: "destructive",
            })
        : input.status === "HIDDEN"
          ? () =>
              confirm({
                confirmLabel: "隐藏留言",
                description: "隐藏后读者侧将不再展示这条留言。",
                title: "确认隐藏留言",
              })
          : undefined,
    );
  }

  function submitSearch() {
    setQuery((current) => ({
      ...current,
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
      <ReaderInbox
        kind="guestbook"
        loading={isLoading}
        total={pagination?.totalItems}
        toolbar={
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索留言内容"
                className="pl-9"
                placeholder="搜索留言、昵称、用户"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
              />
            </div>
            <Button
              aria-label="搜索留言"
              type="button"
              size="icon"
              variant="outline"
              onClick={submitSearch}
            >
              <Search />
            </Button>
            <Select
              aria-label="留言状态"
              value={query.status ?? "ALL"}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  page: 1,
                  status: event.target.value as AdminGuestbookMessagesQuery["status"],
                }))
              }
            >
              <option value="ALL">全部状态</option>
              <option value="VISIBLE">可见</option>
              <option value="HIDDEN">已隐藏</option>
              <option value="DELETED">已删除</option>
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
          selected && author ? (
            <article data-moderation-id={selected.id} className="grid gap-6">
              <header className="flex items-start gap-4">
                <ReaderAvatar large name={author.name} src={author.avatar} />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold wrap-anywhere">
                    {author.name}
                  </h2>
                  {author.profile ? (
                    <a
                      className="mt-1 block text-xs text-muted-foreground hover:text-primary hover:underline"
                      href={author.profile}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{author.login}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">访客</p>
                  )}
                  <p className="mt-2 text-xs/6 text-muted-foreground">
                    {formatDateTime(selected.createdAt)} · 读者留言
                  </p>
                </div>
              </header>
              <ReaderRelatedLink href="/comments" label="阅读文章评论" />
              <p className="min-h-32 text-base/8 wrap-anywhere whitespace-pre-wrap">
                {selected.body}
              </p>
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                <StatusBadge status={selected.status} />
                {selected.isPinned ? <Badge variant="warning">置顶</Badge> : null}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selected.likeCount} 赞
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.guestFingerprint
                    ? `指纹 ${selected.guestFingerprint.slice(0, 18)}…`
                    : "登录用户"}
                </span>
              </div>
              <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
                {updatingMessageId === selected.id ? (
                  <span role="status" className="mr-auto text-sm text-muted-foreground">
                    处理中
                  </span>
                ) : null}
                <Button
                  data-moderation-action="pin"
                  disabled={updatingMessageId !== null}
                  size="sm"
                  variant="outline"
                  onClick={() => void updateMessage(selected, { isPinned: !selected.isPinned })}
                >
                  {selected.isPinned ? <PinOff /> : <Pin />}
                  {selected.isPinned ? "取消置顶" : "置顶"}
                </Button>
                <Button
                  data-moderation-action="visibility"
                  disabled={updatingMessageId !== null}
                  size="sm"
                  variant={selected.status === "VISIBLE" ? "outline" : "default"}
                  onClick={() =>
                    void updateMessage(selected, {
                      status: selected.status === "VISIBLE" ? "HIDDEN" : "VISIBLE",
                    })
                  }
                >
                  {selected.status === "VISIBLE" ? <EyeOff /> : <Eye />}
                  {selected.status === "VISIBLE" ? "隐藏" : "恢复"}
                </Button>
                {selected.status !== "DELETED" ? (
                  <Button
                    data-moderation-action="delete"
                    disabled={updatingMessageId !== null}
                    size="sm"
                    variant="destructive"
                    onClick={() => void updateMessage(selected, { status: "DELETED" })}
                  >
                    <Trash2 />
                    删除
                  </Button>
                ) : null}
              </footer>
            </article>
          ) : (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              {isLoading ? "正在读取来信" : "选择一条来信，阅读完整内容。"}
            </div>
          )
        }
      >
        {isLoading ? <ManagementLoading label="正在加载留言..." /> : null}
        {messages.map((message, index) => {
          const messageAuthor = getAuthor(message);
          return (
            <ReaderInboxItem
              key={message.id}
              active={selected?.id === message.id}
              author={messageAuthor.name}
              avatar={messageAuthor.avatar}
              body={message.body}
              context={message.isPinned ? "留言板 · 已置顶" : "留言板 · 读者留言"}
              date={formatShortDate(message.createdAt)}
              index={index}
              onSelect={() => setSelectedId(message.id)}
            />
          );
        })}
        {isReady && messages.length === 0 ? <ManagementEmpty label="没有符合条件的留言。" /> : null}
      </ReaderInbox>
      <span role="status" className="sr-only">
        {statusMessage}
      </span>
      {confirmationDialog}
    </section>
  );
}

function getAuthor(message: AdminGuestbookMessageListItemResponse) {
  return message.author.type === "GITHUB"
    ? {
        name: message.author.name ?? message.author.login,
        login: message.author.login,
        avatar: message.author.avatarUrl,
        profile: message.author.profileUrl,
      }
    : { name: message.author.nickname, login: null, avatar: null, profile: null };
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminGuestbookMessageStatus }) {
  const meta = guestbookStatusMeta[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const guestbookStatusMeta: Record<
  AdminGuestbookMessageStatus,
  { label: string; variant: "destructive" | "outline" | "success" }
> = {
  DELETED: { label: "已删除", variant: "destructive" },
  HIDDEN: { label: "已隐藏", variant: "outline" },
  VISIBLE: { label: "可见", variant: "success" },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { GuestbookModeration };
