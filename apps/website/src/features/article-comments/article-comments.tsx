"use client";

import { ArticleCommentForm } from "./article-comment-form";
import { ArticleCommentHeader } from "./article-comment-header";
import { ArticleCommentList } from "./article-comment-list";
import { useArticleComments } from "./use-article-comments";

function ArticleComments({ slug }: { slug: string }) {
  const comments = useArticleComments(slug);

  return (
    <section className="mt-12 border-y border-border py-4" aria-label="文章评论">
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
        initialLoadState={comments.initialLoadState}
        loadErrorMessage={comments.loadErrorMessage}
        onRetry={comments.retryLoadComments}
        isLoadingMore={comments.isLoadingMore}
        isSubmitting={comments.isSubmitting}
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
        isReadReady={comments.initialLoadState === "ready"}
        onBodyChange={comments.setBody}
        onCancelReply={comments.cancelReply}
        onSubmit={comments.submitComment}
        replyTarget={comments.replyTarget}
        textareaRef={comments.textareaRef}
        user={comments.user}
      />
    </section>
  );
}

export { ArticleComments };
