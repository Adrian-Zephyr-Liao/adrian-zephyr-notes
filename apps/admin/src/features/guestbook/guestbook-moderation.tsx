import type {
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesQuery,
  AdminGuestbookMessageStatus,
} from "@adrian-zephyr-notes/contracts";
import { Eye, EyeOff, Loader2, Pin, PinOff, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { listAdminGuestbookMessages, updateAdminGuestbookMessage } from "../../lib/admin-api";
import { cn } from "../../lib/utils";

const DEFAULT_PAGE_SIZE = 10;

function GuestbookModeration() {
  const [messages, setMessages] = useState<AdminGuestbookMessageListItemResponse[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<AdminGuestbookMessagesQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    status: "ALL",
  });
  const [searchText, setSearchText] = useState("");
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    void listAdminGuestbookMessages(query)
      .then((response) => {
        setMessages(response.data);
        setPagination(response.pagination);
      })
      .catch(() => setErrorMessage("留言列表加载失败，请检查服务端或管理员权限配置。"))
      .finally(() => setIsLoading(false));
  }, [query]);

  async function updateMessage(
    message: AdminGuestbookMessageListItemResponse,
    input: { isPinned?: boolean; status?: AdminGuestbookMessageStatus },
  ) {
    if (input.status === "DELETED") {
      const confirmed = window.confirm(
        "删除这条留言？删除后读者侧不再展示，可以在已删除状态中恢复。",
      );

      if (!confirmed) {
        return;
      }
    }

    if (input.status === "HIDDEN") {
      const confirmed = window.confirm("隐藏这条留言？读者侧将不再展示。");

      if (!confirmed) {
        return;
      }
    }

    setUpdatingMessageId(message.id);

    try {
      const updated = await updateAdminGuestbookMessage(message.id, input);
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setErrorMessage("留言状态更新失败，请稍后重试。");
    } finally {
      setUpdatingMessageId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>留言板治理</CardTitle>
            <CardDescription>处理留言可见性、置顶和软删除。</CardDescription>
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
              placeholder="搜索留言、昵称、用户"
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
                status: event.target.value as AdminGuestbookMessagesQuery["status"],
              }))
            }
          >
            <option value="ALL">全部状态</option>
            <option value="VISIBLE">可见</option>
            <option value="HIDDEN">已隐藏</option>
            <option value="DELETED">已删除</option>
          </Select>
        </div>
        <div className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载留言...
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-xl border border-border/70 bg-background/65 p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {message.isPinned ? <Badge variant="warning">置顶</Badge> : null}
                    <StatusBadge status={message.status} />
                    <Badge variant="outline">{message.likeCount} 赞</Badge>
                  </div>
                  <p className="text-sm/6 whitespace-pre-wrap">{message.body}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{formatDateTime(message.createdAt)}</span>
                    <span>
                      {message.guestFingerprint
                        ? `指纹 ${message.guestFingerprint.slice(0, 18)}...`
                        : "登录用户"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 lg:items-end">
                  <GuestbookAuthor message={message} />
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      disabled={updatingMessageId === message.id}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => void updateMessage(message, { isPinned: !message.isPinned })}
                    >
                      {message.isPinned ? <PinOff /> : <Pin />}
                      {message.isPinned ? "取消置顶" : "置顶"}
                    </Button>
                    {message.status === "VISIBLE" ? (
                      <Button
                        disabled={updatingMessageId === message.id}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => void updateMessage(message, { status: "HIDDEN" })}
                      >
                        <EyeOff />
                        隐藏
                      </Button>
                    ) : (
                      <Button
                        disabled={updatingMessageId === message.id}
                        size="sm"
                        type="button"
                        onClick={() => void updateMessage(message, { status: "VISIBLE" })}
                      >
                        <Eye />
                        恢复
                      </Button>
                    )}
                    {message.status !== "DELETED" ? (
                      <Button
                        disabled={updatingMessageId === message.id}
                        size="sm"
                        type="button"
                        variant="destructive"
                        onClick={() => void updateMessage(message, { status: "DELETED" })}
                      >
                        <Trash2 />
                        删除
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!isLoading && messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              没有符合条件的留言。
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

function GuestbookAuthor({ message }: { message: AdminGuestbookMessageListItemResponse }) {
  if (message.author.type === "GITHUB") {
    return (
      <div className="flex items-center gap-2 lg:flex-row-reverse">
        {message.author.avatarUrl ? (
          <img
            alt={message.author.login}
            className="size-9 rounded-full ring-1 ring-border"
            src={message.author.avatarUrl}
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {message.author.login.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 lg:text-right">
          <p className="truncate text-sm font-medium">
            {message.author.name ?? message.author.login}
          </p>
          <a
            className="text-xs text-primary hover:underline"
            href={message.author.profileUrl}
            rel="noreferrer"
            target="_blank"
          >
            @{message.author.login}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 lg:flex-row-reverse">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
        {message.author.nickname.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 lg:text-right">
        <p className="truncate text-sm font-medium">{message.author.nickname}</p>
        <p className="text-xs text-muted-foreground">访客</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminGuestbookMessageStatus }) {
  const meta = guestbookStatusMeta[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
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
