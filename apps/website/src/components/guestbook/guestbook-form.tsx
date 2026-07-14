import type { FormEvent } from "react";
import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { Github, LogOut, PenLine, Send } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";
import { GuestAvatar, UserAvatar } from "./guestbook-avatar";
import { GuestbookMascot } from "./guestbook-mascot";
import { GuestbookStampSheet } from "./guestbook-stamp-sheet";

function GuestbookForm({
  body,
  errorMessage,
  guestNickname,
  isSubmitting,
  loginUrl,
  onBodyChange,
  onGuestNicknameChange,
  onLogout,
  onSubmit,
  onWebsiteChange,
  user,
  website,
}: {
  body: string;
  errorMessage: string | null;
  guestNickname: string;
  isSubmitting: boolean;
  loginUrl: string;
  onBodyChange: (body: string) => void;
  onGuestNicknameChange: (nickname: string) => void;
  onLogout: () => void;
  onSubmit: () => void;
  onWebsiteChange: (website: string) => void;
  user: AuthUserResponse | null;
  website: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <aside className="lg:sticky lg:top-24">
      <GlassPanel className="overflow-hidden p-0">
        <div className="relative hidden border-b border-(--glass-border) px-4 pt-4 lg:block">
          <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),transparent_88%),color-mix(in_oklch,var(--secondary),transparent_65%))] p-3 text-xs leading-5 font-semibold text-muted-foreground">
            <GuestbookStampSheet className="absolute -top-4 -right-8 opacity-55" />
            <span className="mb-1 flex items-center gap-1.5 text-foreground">
              <PenLine className="size-3.5 text-primary" />
              写信台
            </span>
            chibi 信使会把你的短笺送到下方星图。
          </div>
          <GuestbookMascot className="mx-auto -mt-1" compact />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-(--glass-border) px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {user ? <UserAvatar user={user} /> : <GuestAvatar seed={guestNickname || "guest"} />}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-foreground">
                {user ? (user.name ?? user.login) : guestNickname || "匿名访客"}
              </p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {user ? `@${user.login}` : "不用登录也可以留言"}
              </p>
            </div>
          </div>

          {user ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onLogout}
              aria-label="退出登录"
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <a href={loginUrl}>
                <Github className="size-4" />
                登录
              </a>
            </Button>
          )}
        </div>

        <form className="grid gap-3 p-4" onSubmit={handleSubmit}>
          {!user ? (
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">昵称</span>
              <input
                value={guestNickname}
                onChange={(event) => onGuestNicknameChange(event.target.value)}
                maxLength={32}
                placeholder="给自己起个名字"
                className="h-10 min-w-0 rounded-xl border border-(--glass-border) bg-white/60 px-3 text-sm font-medium text-foreground transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-out-ui) outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 motion-reduce:transition-none dark:bg-white/8"
              />
            </label>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">短笺内容</span>
            <textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              minLength={1}
              maxLength={1000}
              placeholder="写给这里的一句话..."
              className="min-h-28 w-full min-w-0 resize-none rounded-2xl border border-(--glass-border) bg-[linear-gradient(180deg,color-mix(in_oklch,white_76%,transparent),color-mix(in_oklch,white_55%,transparent)),repeating-linear-gradient(to_bottom,transparent_0_1.65rem,color-mix(in_oklch,var(--primary),transparent_84%)_1.65rem_calc(1.65rem+1px))] px-3.5 py-3 text-sm leading-6 text-foreground transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-out-ui) outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 motion-reduce:transition-none dark:bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_80%,transparent),color-mix(in_oklch,var(--card)_62%,transparent)),repeating-linear-gradient(to_bottom,transparent_0_1.65rem,color-mix(in_oklch,var(--primary),transparent_84%)_1.65rem_calc(1.65rem+1px))]"
            />
          </label>

          <label className="hidden" aria-hidden="true">
            网站
            <input
              tabIndex={-1}
              autoComplete="off"
              name="website"
              value={website}
              onChange={(event) => onWebsiteChange(event.target.value)}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {body.trim().length}/1000
            </span>
            <Button
              type="submit"
              className="shadow-[0_8px_20px_color-mix(in_oklch,var(--primary),transparent_78%)]"
              disabled={
                isSubmitting || body.trim().length === 0 || (!user && !guestNickname.trim())
              }
            >
              <Send className="size-4" />
              {isSubmitting ? "发布中" : "发送"}
            </Button>
          </div>

          {errorMessage ? (
            <output className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {errorMessage}
            </output>
          ) : null}
        </form>
      </GlassPanel>
    </aside>
  );
}

export { GuestbookForm };
