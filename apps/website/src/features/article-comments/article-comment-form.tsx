import type { FormEvent, RefObject } from "react";
import type { ArticleCommentResponse, AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthorAvatar } from "./article-comment-avatar";

function ArticleCommentForm({
  body,
  errorMessage,
  isSubmitting,
  isReadReady,
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
  isReadReady: boolean;
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
    <form className="grid gap-3 border-t border-border py-5" onSubmit={handleSubmit}>
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
            disabled={isSubmitting}
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
          disabled={!user || !isReadReady || isSubmitting}
          className="min-h-20 w-full min-w-0 resize-y rounded-xl border border-border bg-transparent px-3.5 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="self-end"
          disabled={!user || !isReadReady || body.trim().length === 0 || isSubmitting}
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
