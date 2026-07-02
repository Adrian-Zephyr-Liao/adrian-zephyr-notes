import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { Github, LogOut, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthorAvatar } from "./article-comment-avatar";

function ArticleCommentHeader({
  loginUrl,
  onLogout,
  totalItems,
  user,
}: {
  loginUrl: string;
  onLogout: () => void;
  totalItems: number | null;
  user: AuthUserResponse | null;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-(--glass-border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-black tracking-normal text-foreground">
          <MessageCircle className="size-4.5 text-primary" />
          评论
        </h2>
        {totalItems === null ? null : (
          <span className="text-xs font-semibold text-muted-foreground">{totalItems} 条</span>
        )}
      </div>

      {user ? (
        <div className="flex min-w-0 items-center gap-2">
          <AuthorAvatar user={user} size="sm" />
          <span className="max-w-40 min-w-0 truncate text-xs font-semibold text-muted-foreground">
            @{user.login}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="size-4" />
            退出
          </Button>
        </div>
      ) : (
        <Button asChild variant="outline" size="sm">
          <a href={loginUrl}>
            <Github className="size-4" />
            GitHub 登录
          </a>
        </Button>
      )}
    </div>
  );
}

export { ArticleCommentHeader };
