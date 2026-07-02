"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArticleCommentLikeResponse,
  ArticleCommentResponse,
  ArticleCommentsResponse,
  AuthUserResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  ChevronDown,
  ChevronUp,
  Github,
  Heart,
  LogOut,
  MessageCircle,
  Reply,
  Send,
  X,
} from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { StatusIllustration } from "@/components/status/status-illustration";
import { Button } from "@/components/ui/button";
import { isApiRequestError, requestJson } from "@/lib/api-client";
import {
  applyCommentLikeState,
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
  const [likingCommentIds, setLikingCommentIds] = useState<ReadonlySet<string>>(() => new Set());
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
      const comment = await requestJson<ArticleCommentResponse>(
        `/api/articles/${encodeURIComponent(slug)}/comments`,
        {
          method: "POST",
          json: {
            body: trimmedBody,
            parentCommentId: replyTarget?.id ?? null,
          },
        },
      );
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
    } catch (error) {
      if (isApiRequestError(error) && error.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      setErrorMessage(replyTarget ? "回复发布失败，请稍后重试。" : "评论发布失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await requestJson("/api/auth/logout", {
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

  async function handleToggleLike(target: ArticleCommentResponse) {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }

    if (likingCommentIds.has(target.id)) {
      return;
    }

    const previousLikeState: ArticleCommentLikeResponse = {
      commentId: target.id,
      likeCount: target.likeCount,
      likedByMe: target.likedByMe,
    };
    const optimisticLikeState: ArticleCommentLikeResponse = {
      commentId: target.id,
      likeCount: Math.max(target.likeCount + (target.likedByMe ? -1 : 1), 0),
      likedByMe: !target.likedByMe,
    };

    setLikingCommentIds((current) => new Set(current).add(target.id));
    setComments((current) => applyCommentLikeState(current, optimisticLikeState));
    setErrorMessage(null);

    try {
      const likeState = await requestJson<ArticleCommentLikeResponse>(
        `/api/comments/${encodeURIComponent(target.id)}/like`,
        {
          method: target.likedByMe ? "DELETE" : "PUT",
        },
      );
      setComments((current) => applyCommentLikeState(current, likeState));
    } catch (error) {
      if (isApiRequestError(error) && error.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      setComments((current) => applyCommentLikeState(current, previousLikeState));
      setErrorMessage("点赞操作失败，请稍后重试。");
    } finally {
      setLikingCommentIds((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    }
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
    <GlassPanel className="mt-8 overflow-hidden rounded-2xl p-0 sm:rounded-3xl">
      <div className="flex flex-col gap-2 border-b border-(--glass-border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-black tracking-normal text-foreground">
            <MessageCircle className="size-4.5 text-primary" />
            评论
          </h2>
          {pagination ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {pagination.totalItems} 条
            </span>
          ) : null}
        </div>

        {user ? (
          <div className="flex min-w-0 items-center gap-2">
            <AuthorAvatar user={user} size="sm" />
            <span className="max-w-40 min-w-0 truncate text-xs font-semibold text-muted-foreground">
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
          <div className="grid justify-items-center gap-3 px-4 py-7 text-center">
            <StatusIllustration className="max-w-[11rem]" variant="empty-comments" />
            <div className="grid gap-1">
              <p className="text-sm font-black text-foreground">还没有评论</p>
              <p className="text-xs leading-5 text-muted-foreground">登录后可以留下第一条回复。</p>
            </div>
          </div>
        ) : (
          <div className="grid">
            {commentThreads.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                expandedCommentIds={expandedCommentIds}
                likingCommentIds={likingCommentIds}
                onReply={handleReply}
                onToggleLike={handleToggleLike}
                onToggleReplies={toggleReplyExpansion}
              />
            ))}
          </div>
        )}

        {canLoadMore ? (
          <div className="flex justify-center px-4 py-3">
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
              onClick={() => setReplyTarget(null)}
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
            onChange={(event) => setBody(event.target.value)}
            minLength={1}
            maxLength={1000}
            placeholder={
              user ? (replyTarget ? "回复一下..." : "说点什么...") : "登录后可以发表评论"
            }
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
    </GlassPanel>
  );
}

function CommentItem({
  comment,
  depth,
  expandedCommentIds,
  likingCommentIds,
  onReply,
  onToggleLike,
  onToggleReplies,
}: {
  comment: ArticleCommentThreadItem;
  depth: number;
  expandedCommentIds: ReadonlySet<string>;
  likingCommentIds: ReadonlySet<string>;
  onReply: (comment: ArticleCommentResponse) => void;
  onToggleLike: (comment: ArticleCommentResponse) => void;
  onToggleReplies: (commentId: string) => void;
}) {
  const isExpanded = expandedCommentIds.has(comment.id);
  const { canToggleReplies, hiddenReplyCount, visibleReplies } = getVisibleCommentReplies(
    comment,
    isExpanded,
  );

  return (
    <article
      className={
        depth === 0 ? "border-b border-(--glass-border) px-4 py-3 last:border-b-0 sm:px-5" : "py-2"
      }
    >
      <div
        className={
          depth === 0
            ? "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2.5"
            : "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2"
        }
      >
        <AuthorAvatar user={comment.author} size={depth === 0 ? "md" : "sm"} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <a
              href={comment.author.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="max-w-52 min-w-0 truncate text-sm font-semibold text-foreground hover:text-primary"
            >
              {comment.author.name ?? comment.author.login}
            </a>
          </div>
          <p className="mt-0.5 text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-foreground/88">
            {comment.replyContext ? (
              <span className="mr-1 font-semibold text-muted-foreground">
                回复 @{comment.replyContext.login}:
              </span>
            ) : null}
            {comment.body}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            <time dateTime={comment.createdAt} title={formatFullCommentDate(comment.createdAt)}>
              {formatCommentDate(comment.createdAt)}
            </time>
            <button
              type="button"
              className="inline-flex h-5 items-center gap-0.5 rounded-md px-1 transition hover:bg-muted hover:text-foreground"
              onClick={() => onReply(comment)}
            >
              <Reply className="size-3.5" />
              回复
            </button>
            <button
              type="button"
              className="inline-flex h-5 items-center gap-0.5 rounded-md px-1 transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onToggleLike(comment)}
              disabled={likingCommentIds.has(comment.id)}
              aria-label={comment.likedByMe ? "取消点赞" : "点赞"}
              aria-pressed={comment.likedByMe}
            >
              <Heart
                className={comment.likedByMe ? "size-3.5 fill-primary text-primary" : "size-3.5"}
              />
              {comment.likeCount}
            </button>
          </div>
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div
          className={
            depth === 0
              ? "mt-2 ml-9 border-l border-(--glass-border) pl-3 sm:ml-11"
              : "mt-1.5 ml-7 border-l border-(--glass-border) pl-3"
          }
        >
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              expandedCommentIds={expandedCommentIds}
              likingCommentIds={likingCommentIds}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onToggleReplies={onToggleReplies}
            />
          ))}
          {canToggleReplies ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              className="mt-1 inline-flex h-6 items-center gap-1 rounded-md px-1 text-xs font-semibold text-primary hover:bg-primary/8 hover:text-primary/80"
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
  const sizeClassName = size === "sm" ? "size-7 text-xs" : "size-9 text-sm";

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

  try {
    return await requestJson<ArticleCommentsResponse>(
      `/api/articles/${encodeURIComponent(slug)}/comments?${searchParams.toString()}`,
      {
        cache: "no-store",
      },
    );
  } catch {
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
}

async function loadCurrentUser() {
  try {
    const payload = await requestJson<AuthMeResponse>("/api/auth/me", {
      cache: "no-store",
    });
    return payload.user;
  } catch {
    return null;
  }
}

function formatCommentDate(value: string) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatFullCommentDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { ArticleComments };
