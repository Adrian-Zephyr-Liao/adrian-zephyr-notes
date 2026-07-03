import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/articles/$articleId/edit")({
  component: EditArticleRoute,
});

const ArticleWritingPage = lazy(() =>
  import("../features/articles/article-writing-page").then((module) => ({
    default: module.ArticleWritingPage,
  })),
);

function EditArticleRoute() {
  const { articleId } = Route.useParams();

  return (
    <AdminAuthGate returnTo={`/articles/${articleId}/edit`}>
      {(admin, onLogout) => (
        <Suspense fallback={<ArticleWritingPageFallback />}>
          <ArticleWritingPage admin={admin} articleId={articleId} onLogout={onLogout} />
        </Suspense>
      )}
    </AdminAuthGate>
  );
}

function ArticleWritingPageFallback() {
  return (
    <main className="grid h-dvh place-items-center bg-background text-sm text-muted-foreground">
      正在加载写作台...
    </main>
  );
}
