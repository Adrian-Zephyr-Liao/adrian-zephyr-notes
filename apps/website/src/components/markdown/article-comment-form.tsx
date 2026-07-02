import type { FormEvent, RefObject } from "react";
import type { ArticleCommentResponse, AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthorAvatar } from "./article-comment-avatar";

function ArticleCommentForm({
  body,
  errorMessage,
  isSubmitting,
  onBodyChange,
  onCancelReply,
  onSubmit,
  replyTarget,
  textareaRef,
  user,
}: {
  body: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onBodyChange: (body: string) => void;
  onCancelReply: () => void;
  onSubmit: () => void;
  replyTarget: ArticleCommentResponse | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  user: AuthUserResponse | null;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      className="sticky bottom-0 z-10 grid gap-2 border-t border-(--glass-border) bg-background/88 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="article-comment">
        评论内容
      </label>
      {replyTarget ? (
        <div className="grid gap-2 rounded-xl bg-muted/45 px-3 py-2 text-xs text-muted-foreground sm:flex sm:items-center sm:justify-between dark:bg-white/6">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              回复 @{replyTarget.author.login}
            </p>
            <p className="mt-0.5 line-clamp-1 leading-5 wrap-anywhere">{replyTarget.body}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancelReply}
            aria-label="取消回复"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-end gap-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_2rem]">
        {user ? (
          <span className="hidden sm:block">
            <AuthorAvatar user={user} size="sm" />
          </span>
        ) : (
          <span className="hidden sm:block" aria-hidden="true" />
        )}
        <textarea
          ref={textareaRef}
          id="article-comment"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          minLength={1}
          maxLength={1000}
          placeholder={user ? (replyTarget ? "回复一下..." : "说点什么...") : "登录后可以发表评论"}
          disabled={!user || isSubmitting}
          className="min-h-9 w-full min-w-0 resize-none rounded-3xl border border-(--glass-border) bg-white/60 px-3.5 py-2 text-sm leading-5 text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/8"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="self-end"
          disabled={!user || body.trim().length === 0 || isSubmitting}
          aria-label={replyTarget ? "发布回复" : "发布评论"}
        >
          <Send className="size-4" />
        </Button>
      </div>
      {errorMessage ? (
        <output className="text-sm font-semibold text-destructive">{errorMessage}</output>
      ) : null}
      {isSubmitting ? (
        <span className="px-1 text-xs font-semibold text-muted-foreground">发布中</span>
      ) : null}
    </form>
  );
}

export { ArticleCommentForm };
