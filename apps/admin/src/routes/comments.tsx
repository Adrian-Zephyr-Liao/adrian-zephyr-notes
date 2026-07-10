import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { CommentModeration } from "../features/comments/comment-moderation";

type CommentsSearch = {
  commentId?: string;
};

export const Route = createFileRoute("/comments")({
  component: CommentsRoute,
  validateSearch: (search): CommentsSearch => ({
    commentId: typeof search.commentId === "string" ? search.commentId : undefined,
  }),
});

function CommentsRoute() {
  const { commentId } = Route.useSearch();

  return (
    <AdminAuthGate returnTo="/comments">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="comments" onLogout={onLogout}>
          <CommentModeration focusedCommentId={commentId ?? null} />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
