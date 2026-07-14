import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { ArticleWritingPageFallback } from "../features/articles/article-writing-page-fallback";

export const Route = createFileRoute("/articles/new")({
  component: NewArticleRoute,
});

const ArticleWritingPage = lazy(() =>
  import("../features/articles/article-writing-page").then((module) => ({
    default: module.ArticleWritingPage,
  })),
);

function NewArticleRoute() {
  return (
    <AdminAuthGate returnTo="/articles/new">
      {(admin, onLogout) => (
        <Suspense fallback={<ArticleWritingPageFallback />}>
          <ArticleWritingPage admin={admin} onLogout={onLogout} />
        </Suspense>
      )}
    </AdminAuthGate>
  );
}
