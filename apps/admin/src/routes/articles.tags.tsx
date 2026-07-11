import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { ArticleTagManagement } from "../features/articles/article-tag-management";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/articles/tags")({ component: ArticleTagsRoute });

function ArticleTagsRoute() {
  return (
    <AdminAuthGate returnTo="/articles/tags">
      {(admin, onLogout) => (
        <AdminShell admin={admin} articlePage="tags" section="articles" onLogout={onLogout}>
          <ArticleTagManagement />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
