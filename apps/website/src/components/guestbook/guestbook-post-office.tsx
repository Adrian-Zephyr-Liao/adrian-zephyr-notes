import type { ReactNode } from "react";
import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { CircleCheck, PenLine, SendHorizontal, Stamp } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { cn } from "@/lib/utils";
import { GuestbookSorter } from "./guestbook-sorter";
import { GuestbookStampSheet } from "./guestbook-stamp-sheet";

function GuestbookPostOffice({
  bodyLength,
  guestNickname,
  isSubmitting,
  totalMessages,
  user,
}: {
  bodyLength: number;
  guestNickname: string;
  isSubmitting: boolean;
  totalMessages: number;
  user: AuthUserResponse | null;
}) {
  const hasIdentity = Boolean(user || guestNickname.trim());
  const hasBody = bodyLength > 0;
  const progress = isSubmitting ? 100 : (hasIdentity ? 36 : 12) + (hasBody ? 52 : 0);
  const status = getDeliveryStatus({
    hasBody,
    hasIdentity,
    isSubmitting,
  });

  return (
    <GlassPanel className="relative overflow-hidden p-0" aria-label="星邮局分拣台">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary),transparent_90%),transparent_42%,color-mix(in_oklch,var(--secondary),transparent_72%))]"
      />
      <div className="relative grid gap-4 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:p-5">
        <GuestbookSorter className="justify-self-center" />

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">
                AZ Star Post
              </p>
              <h2 className="mt-1 text-xl font-black tracking-normal text-foreground">
                星邮局分拣台
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-(--glass-border) bg-background/60 px-3 py-1.5 text-xs font-black text-foreground backdrop-blur">
              <span className={cn("size-2 rounded-full", status.dotClassName)} aria-hidden="true" />
              {status.label}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-background/65">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),color-mix(in_oklch,var(--secondary),var(--primary)_32%))] transition-[width] duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PostOfficeStep
                active={hasIdentity}
                icon={<PenLine className="size-3.5" />}
                label="署名"
              />
              <PostOfficeStep
                active={hasBody}
                icon={<Stamp className="size-3.5" />}
                label="贴星票"
              />
              <PostOfficeStep
                active={isSubmitting || (hasBody && hasIdentity)}
                icon={<SendHorizontal className="size-3.5" />}
                label="投递"
              />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <p className="text-xs leading-5 font-semibold text-muted-foreground">
              今日邮袋已经收下 <span className="font-black text-foreground">{totalMessages}</span>{" "}
              封短笺。
            </p>
            <GuestbookStampSheet className="hidden shrink-0 sm:block" />
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function PostOfficeStep({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-xl border p-2 text-xs font-black transition",
        active
          ? "border-primary/35 bg-primary/12 text-foreground"
          : "border-(--glass-border) bg-background/45 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {active ? <CircleCheck className="size-3.5" /> : icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function getDeliveryStatus({
  hasBody,
  hasIdentity,
  isSubmitting,
}: {
  hasBody: boolean;
  hasIdentity: boolean;
  isSubmitting: boolean;
}) {
  if (isSubmitting) {
    return {
      dotClassName: "bg-primary motion-safe:animate-pulse",
      label: "投递中",
    };
  }

  if (hasBody && hasIdentity) {
    return {
      dotClassName: "bg-primary",
      label: "待投递",
    };
  }

  if (hasBody) {
    return {
      dotClassName: "bg-secondary",
      label: "待署名",
    };
  }

  return {
    dotClassName: "bg-muted-foreground/55",
    label: "待收信",
  };
}

export { GuestbookPostOffice };
