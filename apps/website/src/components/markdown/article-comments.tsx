"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";
import { Github, LogOut, MessageCircle, Reply, Send, X } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";

type AuthMeResponse = {
  user: AuthUserResponse | null;
};

function ArticleComments({ slug }: { slug: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [comments, setComments] = useState<ArticleCommentResponse[]>([]);
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [pagination, setPagination] = useState<ArticleCommentsResponse["pagination"] | null>(null);
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ArticleCommentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent(`/posts/${slug}`)}`,
    [slug],
  );

  useEffect(() => {
    void Promise.all([loadComments(slug), loadCurrentUser()]).then(
      ([commentsResult, userResult]) => {
        setComments(commentsResult.data);
        setPagination(commentsResult.pagination);
        setUser(userResult);
      },
    );
  }, [slug]);

  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();

    if (!trimmedBody || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          body: trimmedBody,
          parentCommentId: replyTarget?.id ?? null,
        }),
      });

      if (response.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to publish comment: ${response.status}`);
      }

      const comment = (await response.json()) as ArticleCommentResponse;
      setComments((current) => appendComment(current, comment));
      setPagination((current) =>
        current && !comment.parentCommentId
          ? {
              ...current,
              totalItems: current.totalItems + 1,
              totalPages: Math.max(
                current.totalPages,
                Math.ceil((current.totalItems + 1) / current.pageSize),
              ),
            }
          : current,
      );
      setBody("");
      setReplyTarget(null);
    } catch {
      setErrorMessage(replyTarget ? "回复发布失败，请稍后重试。" : "评论发布失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    setUser(null);
  }

  function handleReply(target: ArticleCommentResponse) {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }

    setReplyTarget(target);
    setErrorMessage(null);
  }

  async function handleLoadMore() {
    if (!pagination || isLoadingMore || pagination.page >= pagination.totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = pagination.page + 1;
      const nextComments = await loadComments(slug, nextPage, pagination.pageSize);
      setComments((current) => mergeRootComments(current, nextComments.data));
      setPagination(nextComments.pagination);
    } catch {
      setErrorMessage("加载更多评论失败，请稍后重试。");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const canLoadMore = pagination ? pagination.page < pagination.totalPages : false;

  return (
    <GlassPanel className="mt-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-xl font-black tracking-normal text-foreground">
            <MessageCircle className="size-5 text-primary" />
            评论
          </h2>
          <p className="text-sm text-muted-foreground">使用 GitHub 登录后参与讨论。</p>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <AuthorAvatar user={user} size="sm" />
            <span className="max-w-40 truncate text-sm font-semibold text-muted-foreground">
              @{user.login}
            </span>
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" />
              退出
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline">
            <a href={loginUrl}>
              <Github className="size-4" />
              GitHub 登录
            </a>
          </Button>
        )}
      </div>

      <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="article-comment">
          评论内容
        </label>
        {replyTarget ? (
          <div className="grid gap-2 rounded-2xl border border-(--glass-border) bg-white/45 px-4 py-3 text-sm text-muted-foreground sm:flex sm:items-center sm:justify-between dark:bg-white/6">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                回复 @{replyTarget.author.login}
              </p>
              <p className="mt-1 line-clamp-2 leading-6 wrap-anywhere">{replyTarget.body}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setReplyTarget(null)}
              aria-label="取消回复"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          id="article-comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          minLength={1}
          maxLength={1000}
          placeholder={
            user ? (replyTarget ? "写下回复..." : "写下你的想法...") : "登录后可以发表评论"
          }
          disabled={!user || isSubmitting}
          className="min-h-28 resize-y rounded-2xl border border-(--glass-border) bg-white/55 px-4 py-3 text-sm leading-7 text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/8"
        />
        {errorMessage ? (
          <output className="text-sm font-semibold text-destructive">{errorMessage}</output>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {replyTarget ? (
            <Button type="button" variant="outline" onClick={() => setReplyTarget(null)}>
              取消回复
            </Button>
          ) : null}
          <Button type="submit" disabled={!user || body.trim().length === 0 || isSubmitting}>
            <Send className="size-4" />
            {isSubmitting ? "发布中" : replyTarget ? "发布回复" : "发布评论"}
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-3">
        {comments.length === 0 ? (
          <p className="rounded-2xl bg-white/40 px-4 py-3 text-sm text-muted-foreground dark:bg-white/5">
            还没有评论。
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} depth={0} onReply={handleReply} />
          ))
        )}

        {canLoadMore ? (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "加载中" : "加载更多"}
            </Button>
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function CommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: ArticleCommentResponse;
  depth: number;
  onReply: (comment: ArticleCommentResponse) => void;
}) {
  return (
    <article
      className={
        depth === 0
          ? "grid gap-3 rounded-2xl border border-(--glass-border) bg-white/42 p-4 dark:bg-white/5"
          : "grid gap-3 border-l border-(--glass-border) pl-4"
      }
    >
      <div className="flex gap-3">
        <AuthorAvatar user={comment.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={comment.author.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground hover:text-primary"
            >
              {comment.author.name ?? comment.author.login}
            </a>
            <time
              className="text-xs font-semibold text-muted-foreground"
              dateTime={comment.createdAt}
            >
              {formatCommentDate(comment.createdAt)}
            </time>
          </div>
          <p className="mt-2 text-sm leading-7 wrap-anywhere whitespace-pre-wrap text-muted-foreground">
            {comment.body}
          </p>
          <div className="mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onReply(comment)}>
              <Reply className="size-4" />
              回复
            </Button>
          </div>
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div className="ml-4 grid gap-3 sm:ml-11">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

type AvatarUser = ArticleCommentResponse["author"] | AuthUserResponse;

function AuthorAvatar({ user, size = "md" }: { user: AvatarUser; size?: "sm" | "md" }) {
  const label = user.name ?? user.login;
  const initial = label.slice(0, 1).toUpperCase();
  const sizeClassName = size === "sm" ? "size-8 text-xs" : "size-10 text-sm";

  return (
    <span
      aria-hidden="true"
      className={`${sizeClassName} grid shrink-0 place-items-center rounded-full border border-(--glass-border) bg-primary/10 bg-cover bg-center font-black text-primary`}
      style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
      title={label}
    >
      {user.avatarUrl ? null : initial}
    </span>
  );
}

function appendComment(
  comments: ArticleCommentResponse[],
  comment: ArticleCommentResponse,
): ArticleCommentResponse[] {
  if (!comment.parentCommentId) {
    return [...comments, comment];
  }

  return comments.map((current) => {
    if (current.id === comment.parentCommentId) {
      return {
        ...current,
        replies: [...current.replies, comment],
      };
    }

    return {
      ...current,
      replies: appendComment(current.replies, comment),
    };
  });
}

function mergeRootComments(
  currentComments: ArticleCommentResponse[],
  nextComments: ArticleCommentResponse[],
) {
  const currentIds = new Set(currentComments.map((comment) => comment.id));
  const uniqueNextComments = nextComments.filter((comment) => !currentIds.has(comment.id));
  return [...currentComments, ...uniqueNextComments];
}

async function loadComments(
  slug: string,
  page = 1,
  pageSize = 20,
): Promise<ArticleCommentsResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(
    `/api/articles/${encodeURIComponent(slug)}/comments?${searchParams.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      data: [],
      pagination: {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  return (await response.json()) as ArticleCommentsResponse;
}

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as AuthMeResponse;
  return payload.user;
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { ArticleComments };
