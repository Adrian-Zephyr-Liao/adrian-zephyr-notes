import type { AuthUserResponse, GuestbookMessageResponse } from "@adrian-zephyr-notes/contracts";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAuthorName } from "./guestbook-avatar";
import { formatShortDate } from "./guestbook-date";
import styles from "./guestbook-effects.module.css";
import { GuestbookMascot } from "./guestbook-mascot";

const guestStars = [
  "left-[8%] top-[20%] size-1.5 delay-0",
  "left-[17%] top-[68%] size-1 delay-150",
  "left-[31%] top-[30%] size-2 delay-300",
  "left-[48%] top-[78%] size-1.5 delay-500",
  "left-[62%] top-[18%] size-1 delay-700",
  "left-[78%] top-[58%] size-2 delay-1000",
  "left-[91%] top-[35%] size-1.5 delay-200",
];

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
    <div className="relative overflow-hidden rounded-[2rem] border border-(--glass-border) bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklch,var(--primary),transparent_66%),transparent_34%),linear-gradient(135deg,color-mix(in_oklch,var(--background),var(--primary)_7%),color-mix(in_oklch,var(--background),var(--foreground)_4%))] px-4 py-8 shadow-(--shadow-glass) sm:px-7 sm:py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,color-mix(in_oklch,var(--primary),transparent_90%)_42%,transparent_78%)] opacity-80"
      />
      {guestStars.map((className) => (
        <span
          key={className}
          aria-hidden="true"
          className={cn(
            "absolute rounded-full bg-primary/70 shadow-[0_0_18px_color-mix(in_oklch,var(--primary),transparent_20%)] motion-safe:animate-pulse",
            className,
          )}
        />
      ))}

      <GuestbookMascot className="absolute right-3 bottom-3 z-10 hidden opacity-95 lg:block" />

      <div
        aria-hidden="true"
        className={cn(
          styles.mailRoute,
          "absolute top-10 right-24 hidden h-28 w-52 rounded-[999px] border-t border-dashed border-primary/45 lg:block",
        )}
      />

      <div className="relative z-20 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:pr-36">
        <div className="grid max-w-2xl gap-4">
          <Badge variant="outline" className="h-6 w-fit bg-background/55 backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            星邮局营业中
          </Badge>
          <div className="grid gap-3">
            <h1 className="text-3xl font-black tracking-normal text-foreground sm:text-5xl">
              留言板
            </h1>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              这里收集路过的人递来的短笺，chibi 信使会把每句话送进 AZ Notes 的访客星图。
            </p>
          </div>
          <GuestbookMascot className="justify-self-end sm:hidden" compact />
        </div>

        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <HeroStat label="投递" value={`${totalMessages} 封`} />
            <HeroStat label="身份" value={user ? "已署名" : "匿名可写"} />
            <HeroStat
              label="最近"
              value={latestMessage ? formatShortDate(latestMessage.createdAt) : "等待中"}
            />
          </div>
          {latestMessage ? <LatestNotePreview message={latestMessage} /> : null}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--glass-border) bg-background/55 px-3 py-2.5 backdrop-blur">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-black text-foreground">{value}</p>
    </div>
  );
}

function LatestNotePreview({ message }: { message: GuestbookMessageResponse }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/35 bg-background/60 px-3 py-2.5 backdrop-blur">
      <span
        aria-hidden="true"
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-[0.65rem] border border-primary/35 bg-primary/10 text-[0.58rem] font-black text-primary"
      >
        AZ
      </span>
      <p className="max-w-[13rem] truncate pr-8 text-xs font-black text-foreground">
        {getAuthorName(message.author)}
      </p>
      <p className="mt-1 line-clamp-2 max-w-[13rem] text-xs leading-5 text-muted-foreground">
        {message.body}
      </p>
    </div>
  );
}

export { GuestbookHero };
