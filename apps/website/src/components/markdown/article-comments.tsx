"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  ChevronDown,
  ChevronUp,
  Github,
  LogOut,
  MessageCircle,
  Reply,
  Send,
  X,
} from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Button } from "@/components/ui/button";
import {
  createArticleCommentThreads,
  findReplyExpansionTargetId,
  getVisibleCommentReplies,
  type ArticleCommentThreadItem,
} from "./article-comment-thread";

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
  const [expandedCommentIds, setExpandedCommentIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loginUrl = useMemo(
    () => `/api/auth/github/start?returnTo=${encodeURIComponent(`/posts/${slug}`)}`,
    [slug],
  );

  useEffect(() => {
    setExpandedCommentIds(new Set());
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
      const expansionTargetId = comment.parentCommentId
        ? findReplyExpansionTargetId(comments, comment.parentCommentId)
        : null;
      setComments((current) => appendComment(current, comment));
      if (expansionTargetId) {
        setExpandedCommentIds((current) => new Set(current).add(expansionTargetId));
      }
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

  function toggleReplyExpansion(commentId: string) {
    setExpandedCommentIds((current) => {
      const next = new Set(current);

      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }

      return next;
    });
  }

  const canLoadMore = pagination ? pagination.page < pagination.totalPages : false;
  const commentThreads = useMemo(() => createArticleCommentThreads(comments), [comments]);

  return (
    <GlassPanel className="mt-8 overflow-hidden rounded-3xl p-0">
      <div className="flex flex-col gap-3 border-b border-(--glass-border) px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-normal text-foreground">
            <MessageCircle className="size-5 text-primary" />
            评论
          </h2>
          {pagination ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {pagination.totalItems} 条主评论
            </span>
          ) : null}
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <AuthorAvatar user={user} size="sm" />
            <span className="max-w-40 truncate text-sm font-semibold text-muted-foreground">
              @{user.login}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
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

      <div className="max-h-[70vh] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">还没有评论。</p>
        ) : (
          <div className="divide-y divide-(--glass-border)">
            {commentThreads.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                expandedCommentIds={expandedCommentIds}
                onReply={handleReply}
                onToggleReplies={toggleReplyExpansion}
              />
            ))}
          </div>
        )}

        {canLoadMore ? (
          <div className="flex justify-center px-5 py-4">
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

      <form
        className="sticky bottom-0 z-10 grid gap-3 border-t border-(--glass-border) bg-background/85 px-4 py-3 backdrop-blur-xl"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="article-comment">
          评论内容
        </label>
        {replyTarget ? (
          <div className="grid gap-2 rounded-2xl bg-muted/45 px-4 py-3 text-sm text-muted-foreground sm:flex sm:items-center sm:justify-between dark:bg-white/6">
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
        <div className="flex items-end gap-3">
          {user ? <AuthorAvatar user={user} size="sm" /> : null}
          <textarea
            ref={textareaRef}
            id="article-comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            minLength={1}
            maxLength={1000}
            placeholder={
              user ? (replyTarget ? "回复一下..." : "说点什么...") : "登录后可以发表评论"
            }
            disabled={!user || isSubmitting}
            className="min-h-11 flex-1 resize-none rounded-3xl border border-(--glass-border) bg-white/60 px-4 py-2.5 text-sm leading-6 text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/8"
          />
          <Button
            type="submit"
            size="icon"
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
    </GlassPanel>
  );
}

function CommentItem({
  comment,
  depth,
  expandedCommentIds,
  onReply,
  onToggleReplies,
}: {
  comment: ArticleCommentThreadItem;
  depth: number;
  expandedCommentIds: ReadonlySet<string>;
  onReply: (comment: ArticleCommentResponse) => void;
  onToggleReplies: (commentId: string) => void;
}) {
  const isExpanded = expandedCommentIds.has(comment.id);
  const { canToggleReplies, hiddenReplyCount, visibleReplies } = getVisibleCommentReplies(
    comment,
    isExpanded,
  );

  return (
    <article className={depth === 0 ? "px-5 py-4" : "py-2"}>
      <div className={depth === 0 ? "flex gap-3" : "flex gap-2"}>
        <AuthorAvatar user={comment.author} size={depth === 0 ? "md" : "sm"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={comment.author.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="max-w-44 truncate text-sm font-semibold text-foreground hover:text-primary"
            >
              {comment.author.name ?? comment.author.login}
            </a>
            <time
              className="text-xs font-medium text-muted-foreground"
              dateTime={comment.createdAt}
            >
              {formatCommentDate(comment.createdAt)}
            </time>
          </div>
          <p className="mt-1 text-sm leading-7 wrap-anywhere whitespace-pre-wrap text-foreground/86">
            {comment.replyContext ? (
              <span className="mr-1 font-semibold text-muted-foreground">
                回复 @{comment.replyContext.login}:
              </span>
            ) : null}
            {comment.body}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onReply(comment)}>
              <Reply className="size-4" />
              回复
            </Button>
          </div>
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div
          className={
            depth === 0
              ? "mt-3 ml-12 rounded-2xl bg-muted/38 px-3 py-2 dark:bg-white/5"
              : "mt-2 ml-10 border-l border-(--glass-border) pl-3"
          }
        >
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              expandedCommentIds={expandedCommentIds}
              onReply={onReply}
              onToggleReplies={onToggleReplies}
            />
          ))}
          {canToggleReplies ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
              onClick={() => onToggleReplies(comment.id)}
            >
              {isExpanded ? (
                <>
                  收起回复
                  <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  展开 {hiddenReplyCount} 条回复
                  <ChevronDown className="size-3.5" />
                </>
              )}
            </button>
          ) : null}
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
