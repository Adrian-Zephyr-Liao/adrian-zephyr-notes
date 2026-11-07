import type { FormEvent, ReactNode } from "react";
import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { ArrowUpRight, Github, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestAvatar, UserAvatar } from "./guestbook-avatar";

function GuestbookForm({
  body,
  errorMessage,
  guestNickname,
  isSubmitting,
  isReadReady,
  onLogin,
  draftNotice,
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
  isReadReady: boolean;
  onLogin: () => void;
  draftNotice: ReactNode;
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
    <aside
      className="order-first max-w-[600px] min-w-0 border-t border-border pt-6 min-[801px]:sticky min-[801px]:top-28 min-[801px]:order-0 min-[801px]:max-w-none"
      aria-label="写下留言"
    >
      <h2 className="mb-[0.45rem] text-[1.35rem] font-bold">这次，换你来写</h2>
      <p className="mb-6 text-[0.8rem] leading-[1.8] text-muted-foreground">
        一千字以内，随意一点就好。
      </p>
      <div className="flex items-center justify-between gap-4 pb-6">
        <div className="flex min-w-0 items-center gap-3">
          {user ? <UserAvatar user={user} /> : <GuestAvatar seed={guestNickname || "guest"} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {user ? (user.name ?? user.login) : guestNickname || "匿名访客"}
            </p>
            <small className="text-[0.7rem] text-muted-foreground">
              {user ? `@${user.login}` : "不用登录也可以留言"}
            </small>
          </div>
        </div>
        {user ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onLogout}
            disabled={isSubmitting}
            aria-label="退出登录"
          >
            <LogOut className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onLogin} variant="outline" size="sm">
            <Github className="size-4" />
            登录
          </Button>
        )}
      </div>
      {draftNotice}
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {!user ? (
          <label className="grid gap-[0.65rem] text-[0.8rem] text-muted-foreground">
            <span>昵称</span>
            <input
              className="min-h-[2.85rem] w-full min-w-0 rounded-[0.65rem] border border-border bg-transparent px-[0.85rem] py-[0.65rem] text-base text-foreground outline-none placeholder:text-muted-foreground placeholder:opacity-70 focus:border-primary focus:ring-3 focus:ring-primary/15 min-[601px]:text-[0.9rem]"
              value={guestNickname}
              disabled={isSubmitting}
              onChange={(event) => onGuestNicknameChange(event.target.value)}
              maxLength={32}
              placeholder="怎么称呼你"
            />
          </label>
        ) : null}
        <label className="grid gap-[0.65rem] text-[0.8rem] text-muted-foreground">
          <span>留言内容</span>
          <textarea
            className="min-h-40 w-full min-w-0 resize-y rounded-[0.65rem] border border-border bg-transparent p-[0.85rem] text-base leading-[1.9] text-foreground outline-none placeholder:text-muted-foreground placeholder:opacity-70 focus:border-primary focus:ring-3 focus:ring-primary/15 min-[601px]:text-[0.9rem]"
            value={body}
            disabled={isSubmitting}
            onChange={(event) => onBodyChange(event.target.value)}
            minLength={1}
            maxLength={1000}
            placeholder="写给这里的一句话…"
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
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>{body.trim().length}/1000</span>
          <Button
            type="submit"
            disabled={
              !isReadReady ||
              isSubmitting ||
              body.trim().length === 0 ||
              (!user && !guestNickname.trim())
            }
          >
            {isSubmitting ? "发布中" : "留下纸条"}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Button>
        </div>
        {!isReadReady ? (
          <output className="text-xs leading-[1.8] text-muted-foreground">
            留言加载完成后即可发布，输入的内容会保留。
          </output>
        ) : null}
        {errorMessage ? (
          <output className="text-[0.85rem] leading-[1.8] text-destructive">{errorMessage}</output>
        ) : null}
      </form>
    </aside>
  );
}
export { GuestbookForm };
