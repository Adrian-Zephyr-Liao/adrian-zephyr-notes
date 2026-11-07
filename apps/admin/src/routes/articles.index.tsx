import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/admin/admin-shell";
import { ArticleManagement } from "../features/articles/article-management";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/articles/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q.trim() || undefined : undefined,
  }),
  component: ArticlesRoute,
});

function ArticlesRoute() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminAuthGate returnTo="/articles">
      {(admin, onLogout) => (
        <AdminShell admin={admin} articlePage="list" section="articles" onLogout={onLogout}>
          <ArticleManagement
            searchQuery={q ?? ""}
            onSearchSubmit={(nextQuery) => {
              void navigate({ search: { q: nextQuery || undefined } });
            }}
          />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
