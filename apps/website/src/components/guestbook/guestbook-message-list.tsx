import type { GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { Heart, MailOpen, SendHorizontal } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";
import { InlineActionButton } from "@/components/ui/inline-action-button";
import { AuthorAvatar, AuthorName, getAuthorName } from "./guestbook-avatar";
import { formatFullDate, formatShortDate } from "./guestbook-date";
import { GuestbookMailbox } from "./guestbook-mailbox";
import { GuestbookStampSheet } from "./guestbook-stamp-sheet";

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
          <MailOpen className="size-5 shrink-0 text-primary" />
          <h2 className="truncate text-lg font-black tracking-normal text-foreground">收件箱</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {totalItems === null ? null : (
            <span className="text-xs font-semibold text-muted-foreground">{totalItems} 封</span>
          )}
          <GuestbookMailbox className="-my-3 hidden sm:block" />
        </div>
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
        <GuestbookMailbox className="size-24" />
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
    <article className="group relative overflow-hidden rounded-2xl border border-(--glass-border) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--background),white_36%),color-mix(in_oklch,var(--background),var(--primary)_5%))] p-3 shadow-(--shadow-glass) transition-[border-color,box-shadow,translate] duration-200 ease-(--ease-out-ui) hover:border-primary/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5">
      <GuestbookStampSheet className="absolute -right-9 -bottom-7 opacity-0 transition-opacity duration-200 ease-(--ease-out-ui) group-hover:opacity-75 motion-reduce:transition-none sm:opacity-35" />
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-0 h-px bg-[repeating-linear-gradient(to_right,color-mix(in_oklch,var(--primary),transparent_45%)_0_0.35rem,transparent_0.35rem_0.7rem)]"
      />
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.25rem] gap-3">
        <AuthorAvatar author={message.author} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <AuthorName author={message.author} />
            <time
              dateTime={message.createdAt}
              title={formatFullDate(message.createdAt)}
              className="shrink-0 text-xs font-medium text-muted-foreground"
            >
              {formatShortDate(message.createdAt)}
            </time>
          </div>
          <p className="mt-1.5 text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-foreground/90">
            {message.body}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex h-6 items-center gap-1">
              <SendHorizontal className="size-3.5 text-primary/75" />
              已投递
            </span>
            <InlineActionButton
              size="sm"
              onClick={() => onToggleLike(message)}
              disabled={isLiking}
              aria-label={`给 ${authorName} 的留言点赞`}
              aria-pressed={message.likedByMe}
            >
              <Heart
                className={message.likedByMe ? "size-3.5 fill-primary text-primary" : "size-3.5"}
              />
              {message.likeCount}
            </InlineActionButton>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-xl border border-dashed border-primary/35 bg-primary/8 text-[0.55rem] font-black text-primary transition-transform duration-150 ease-(--ease-out-ui) motion-reduce:transition-none motion-reduce:group-hover:rotate-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-3"
        >
          AZ
        </div>
      </div>
    </article>
  );
}

export { GuestbookMessageList };
