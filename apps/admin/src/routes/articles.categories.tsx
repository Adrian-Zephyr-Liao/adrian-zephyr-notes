import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { ArticleCategoryManagement } from "../features/articles/article-category-management";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/articles/categories")({
  component: ArticleCategoriesRoute,
});

function ArticleCategoriesRoute() {
  return (
    <AdminAuthGate returnTo="/articles/categories">
      {(admin, onLogout) => (
        <AdminShell admin={admin} articlePage="categories" section="articles" onLogout={onLogout}>
          <ArticleCategoryManagement />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
