import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { ArticleManagement } from "../features/articles/article-management";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/articles/")({
  component: ArticlesRoute,
});

function ArticlesRoute() {
  return (
    <AdminAuthGate returnTo="/articles">
      {(admin, onLogout) => (
        <AdminShell admin={admin} articlePage="list" section="articles" onLogout={onLogout}>
          <ArticleManagement />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
