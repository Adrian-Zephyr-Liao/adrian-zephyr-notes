import type { FormEvent } from "react";
import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { Github, LogOut, Send } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";
import { GuestAvatar, UserAvatar } from "./guestbook-avatar";

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
                className="h-10 min-w-0 rounded-xl border border-(--glass-border) bg-white/60 px-3 text-sm font-medium text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 dark:bg-white/8"
              />
            </label>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">想说什么</span>
            <textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              minLength={1}
              maxLength={1000}
              placeholder="说点什么..."
              className="min-h-28 w-full min-w-0 resize-none rounded-2xl border border-(--glass-border) bg-white/60 px-3.5 py-3 text-sm leading-6 text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 dark:bg-white/8"
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
