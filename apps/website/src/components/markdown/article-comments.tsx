"use client";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { ArticleCommentForm } from "./article-comment-form";
import { ArticleCommentHeader } from "./article-comment-header";
import { ArticleCommentList } from "./article-comment-list";
import { useArticleComments } from "./use-article-comments";

function ArticleComments({ slug }: { slug: string }) {
  const comments = useArticleComments(slug);

  return (
    <GlassPanel className="mt-8 overflow-hidden rounded-2xl p-0 sm:rounded-3xl">
      <ArticleCommentHeader
        loginUrl={comments.loginUrl}
        onLogout={comments.logout}
        totalItems={comments.pagination?.totalItems ?? null}
        user={comments.user}
      />

      <ArticleCommentList
        canLoadMore={comments.canLoadMore}
        commentThreads={comments.commentThreads}
        expandedCommentIds={comments.expandedCommentIds}
        isLoadingMore={comments.isLoadingMore}
        likingCommentIds={comments.likingCommentIds}
        onLoadMore={comments.loadMore}
        onReply={comments.replyToComment}
        onToggleLike={comments.toggleLike}
        onToggleReplies={comments.toggleReplyExpansion}
      />

      <ArticleCommentForm
        body={comments.body}
        errorMessage={comments.errorMessage}
        isSubmitting={comments.isSubmitting}
        onBodyChange={comments.setBody}
        onCancelReply={comments.cancelReply}
        onSubmit={comments.submitComment}
        replyTarget={comments.replyTarget}
        textareaRef={comments.textareaRef}
        user={comments.user}
      />
    </GlassPanel>
  );
}

export { ArticleComments };
