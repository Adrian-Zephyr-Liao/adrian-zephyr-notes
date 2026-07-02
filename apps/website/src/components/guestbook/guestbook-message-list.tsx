import type { GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { Heart, MessageCircle, Star } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";
import { AuthorAvatar, AuthorName, getAuthorName } from "./guestbook-avatar";
import { formatFullDate, formatShortDate } from "./guestbook-date";

function GuestbookMessageList({
  canLoadMore,
  isLoadingMore,
  likingMessageIds,
  messages,
  onLoadMore,
  onToggleLike,
  totalItems,
}: {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  likingMessageIds: ReadonlySet<string>;
  messages: GuestbookMessageResponse[];
  onLoadMore: () => void;
  onToggleLike: (message: GuestbookMessageResponse) => void;
  totalItems: number | null;
}) {
  return (
    <section className="grid gap-3" aria-label="留言列表">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="size-5 shrink-0 text-primary" />
          <h2 className="truncate text-lg font-black tracking-normal text-foreground">最新留言</h2>
        </div>
        {totalItems === null ? null : (
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {totalItems} 条
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <EmptyGuestbookState />
      ) : (
        <div className="grid gap-3">
          {messages.map((message) => (
            <GuestbookMessageItem
              key={message.id}
              message={message}
              isLiking={likingMessageIds.has(message.id)}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      )}

      {canLoadMore ? (
        <div className="flex justify-center pt-1">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "加载中" : "加载更多"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function EmptyGuestbookState() {
  return (
    <GlassPanel className="grid min-h-64 place-items-center overflow-hidden p-6 text-center">
      <div className="relative grid justify-items-center gap-3">
        <div
          aria-hidden="true"
          className="absolute inset-x-[-3rem] top-4 h-px bg-linear-to-r from-transparent via-primary/45 to-transparent"
        />
        <span className="grid size-14 place-items-center rounded-full border border-(--glass-border) bg-primary/10 text-primary">
          <Star className="size-7" />
        </span>
        <div className="grid gap-1">
          <p className="text-base font-black text-foreground">还没有留言</p>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            写下第一条留言，它会成为这里的第一颗星。
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

function GuestbookMessageItem({
  isLiking,
  message,
  onToggleLike,
}: {
  isLiking: boolean;
  message: GuestbookMessageResponse;
  onToggleLike: (message: GuestbookMessageResponse) => void;
}) {
  const authorName = getAuthorName(message.author);

  return (
    <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-(--glass-border) px-1 pb-3 last:border-b-0">
      <AuthorAvatar author={message.author} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <AuthorName author={message.author} />
          <time
            dateTime={message.createdAt}
            title={formatFullDate(message.createdAt)}
            className="shrink-0 text-xs font-medium text-muted-foreground"
          >
            {formatShortDate(message.createdAt)}
          </time>
        </div>
        <p className="mt-1 text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-foreground/90">
          {message.body}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex h-6 items-center gap-1">
            <MessageCircle className="size-3.5" />
            留言
          </span>
          <button
            type="button"
            className="inline-flex h-6 items-center gap-1 rounded-md px-1 transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            onClick={() => onToggleLike(message)}
            disabled={isLiking}
            aria-label={`给 ${authorName} 的留言点赞`}
            aria-pressed={message.likedByMe}
          >
            <Heart
              className={message.likedByMe ? "size-3.5 fill-primary text-primary" : "size-3.5"}
            />
            {message.likeCount}
          </button>
        </div>
      </div>
    </article>
  );
}

export { GuestbookMessageList };
