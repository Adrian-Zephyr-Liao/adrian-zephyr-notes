import type { AuthUserResponse, GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { formatShortDate } from "./guestbook-date";
import { GuestbookMascot } from "./guestbook-mascot";

function GuestbookHero({
  latestMessage,
  totalMessages,
  user,
}: {
  latestMessage: GuestbookMessageResponse | null;
  totalMessages: number;
  user: AuthUserResponse | null;
}) {
  return (
    <header>
      <div className="flex items-start justify-between gap-3 border-b border-border pb-7 min-[601px]:items-end min-[601px]:gap-8 min-[601px]:pb-11">
        <div>
          <p
            className="font-display text-[clamp(2.75rem,11vw,4rem)] leading-none tracking-[-0.065em] italic min-[601px]:text-[clamp(4rem,8vw,7.5rem)]"
            lang="en"
          >
            Guestbook
          </p>
          <h1 className="mt-3 mb-5 text-[2rem] leading-[1.25] font-bold tracking-[-0.035em] min-[601px]:text-[clamp(2.25rem,4.5vw,4rem)]">
            留一张纸条
          </h1>
          <p className="max-w-[38rem] text-[0.85rem] leading-[1.9] text-muted-foreground min-[601px]:text-base">
            来过这里，便留下一点声音。聊聊最近在做的事，分享一个想法，或者只是打个招呼。
          </p>
        </div>
        <div className="flex shrink-0 items-end gap-0 min-[1051px]:gap-6">
          <GuestbookMascot compact className="hidden min-[801px]:block" />
          <div className="grid gap-[0.65rem] pt-2 pb-1 text-right text-[0.65rem] whitespace-nowrap text-muted-foreground min-[601px]:pt-0 min-[601px]:text-[0.8rem] min-[801px]:pb-2">
            <span className="font-display text-[3.5rem] leading-[0.8] tracking-[-0.07em] text-[color-mix(in_oklch,var(--primary)_40%,var(--background))] italic min-[601px]:text-[clamp(4rem,9vw,8rem)]">
              {String(totalMessages).padStart(2, "0")}
            </span>
            <span>条相遇的记录</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4 text-[0.8rem] text-muted-foreground">
        <span>{user ? `${user.name ?? user.login}，欢迎回来。` : "不必登录，也能留下想法。"}</span>
        {latestMessage ? (
          <span>最近一张纸条 · {formatShortDate(latestMessage.createdAt)}</span>
        ) : null}
      </div>
    </header>
  );
}
export { GuestbookHero };
