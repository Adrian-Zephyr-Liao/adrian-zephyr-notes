import type { GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineActionButton } from "@/components/ui/inline-action-button";
import { AuthorAvatar, AuthorName, getAuthorName } from "./guestbook-avatar";
import { formatFullDate, formatShortDate } from "./guestbook-date";

function GuestbookMessageList({
  canLoadMore,
  isLoadingMore,
  loadState,
  loadMoreError,
  likingMessageIds,
  messages,
  onLoadMore,
  onRetry,
  onToggleLike,
  totalItems,
}: {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  loadState: "loading" | "ready" | "error";
  loadMoreError: string | null;
  likingMessageIds: ReadonlySet<string>;
  messages: GuestbookMessageResponse[];
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleLike: (message: GuestbookMessageResponse) => void;
  totalItems: number | null;
}) {
  return (
    <section className="min-w-0" aria-label="留言列表" aria-busy={loadState === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <h2 className="text-[1.4rem] font-bold">路过的人，写下的话</h2>
        {totalItems === null ? null : (
          <span className="text-[0.8rem] text-muted-foreground">{totalItems} 条留言</span>
        )}
      </div>
      {loadState === "loading" ? (
        <output className="block py-10 text-sm text-muted-foreground">正在读取留言…</output>
      ) : loadState === "error" ? (
        <div className="grid justify-items-start gap-4 py-10">
          <p role="alert" className="text-sm text-destructive">
            留言暂时无法读取，请重试。
          </p>
          <Button type="button" variant="outline" onClick={onRetry}>
            重新加载留言
          </Button>
        </div>
      ) : null}
      {messages.length === 0 && loadState === "ready" ? (
        <div className="grid min-h-64 content-center justify-items-start gap-3 py-8">
          <h3 className="text-[1.35rem] font-bold">这里还留着空白</h3>
          <p className="text-[0.9rem] leading-[1.8] text-muted-foreground">
            写下第一张纸条，和下一位路过的人分享。
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <GuestbookMessageItem
            key={message.id}
            message={message}
            isLiking={likingMessageIds.has(message.id)}
            onToggleLike={onToggleLike}
          />
        ))
      )}
      {loadMoreError ? (
        <p role="alert" className="pt-6 text-sm text-destructive">
          {loadMoreError}
        </p>
      ) : null}
      {canLoadMore ? (
        <div className="flex justify-center pt-8">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "加载中" : loadMoreError ? "重试加载更多" : "加载更多"}
          </Button>
        </div>
      ) : null}
    </section>
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
    <article className="border-b border-border py-7">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 min-[601px]:grid-cols-[2.75rem_minmax(0,1fr)] min-[601px]:gap-4">
        <AuthorAvatar author={message.author} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-[0.4rem]">
            <AuthorName author={message.author} />
            <time
              className="text-xs text-muted-foreground"
              dateTime={message.createdAt}
              title={formatFullDate(message.createdAt)}
            >
              {formatShortDate(message.createdAt)}
            </time>
          </div>
          <p className="mt-[0.65rem] mb-3 text-[0.95rem] leading-[1.9] wrap-anywhere whitespace-pre-wrap min-[601px]:text-base">
            {message.body}
          </p>
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
    </article>
  );
}
export { GuestbookMessageList };
