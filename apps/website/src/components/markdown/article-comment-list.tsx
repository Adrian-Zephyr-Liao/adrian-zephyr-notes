import type { ArticleCommentResponse } from "@adrian-zephyr-notes/contracts";
import { ChevronDown, ChevronUp, Heart, Reply } from "lucide-react";

import { StatusIllustration } from "@/components/status/status-illustration";
import { Button } from "@/components/ui/button";
import { InlineActionButton } from "@/components/ui/inline-action-button";
import { AuthorAvatar } from "./article-comment-avatar";
import { formatCommentDate, formatFullCommentDate } from "./article-comment-date";
import { getVisibleCommentReplies, type ArticleCommentThreadItem } from "./article-comment-thread";

function ArticleCommentList({
  canLoadMore,
  commentThreads,
  expandedCommentIds,
  isLoadingMore,
  likingCommentIds,
  onLoadMore,
  onReply,
  onToggleLike,
  onToggleReplies,
}: {
  canLoadMore: boolean;
  commentThreads: ArticleCommentThreadItem[];
  expandedCommentIds: ReadonlySet<string>;
  isLoadingMore: boolean;
  likingCommentIds: ReadonlySet<string>;
  onLoadMore: () => void;
  onReply: (comment: ArticleCommentResponse) => void;
  onToggleLike: (comment: ArticleCommentResponse) => void;
  onToggleReplies: (commentId: string) => void;
}) {
  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {commentThreads.length === 0 ? (
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
              onReply={onReply}
              onToggleLike={onToggleLike}
              onToggleReplies={onToggleReplies}
            />
          ))}
        </div>
      )}

      {canLoadMore ? (
        <div className="flex justify-center px-4 py-3">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "加载中" : "加载更多"}
          </Button>
        </div>
      ) : null}
    </div>
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
  const authorName = comment.author.name ?? comment.author.login;
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
            <InlineActionButton aria-label={`回复 ${authorName}`} onClick={() => onReply(comment)}>
              <Reply className="size-3.5" />
              回复
            </InlineActionButton>
            <InlineActionButton
              onClick={() => onToggleLike(comment)}
              disabled={likingCommentIds.has(comment.id)}
              aria-label={
                comment.likedByMe
                  ? `取消给 ${authorName} 的评论点赞`
                  : `给 ${authorName} 的评论点赞`
              }
              aria-pressed={comment.likedByMe}
            >
              <Heart
                className={comment.likedByMe ? "size-3.5 fill-primary text-primary" : "size-3.5"}
              />
              {comment.likeCount}
            </InlineActionButton>
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
            <InlineActionButton
              aria-expanded={isExpanded}
              className="mt-1 font-semibold"
              size="sm"
              variant="primary"
              aria-label={isExpanded ? "收起回复" : `展开 ${hiddenReplyCount} 条回复`}
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
            </InlineActionButton>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export { ArticleCommentList };
