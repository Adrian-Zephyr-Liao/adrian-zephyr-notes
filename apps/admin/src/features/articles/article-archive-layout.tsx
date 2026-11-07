import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type ArticleArchivePage = "articles" | "categories" | "tags";

function ArticleArchiveLayout({
  page,
  children,
}: {
  page: ArticleArchivePage;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-7 lg:grid-cols-[7.5rem_minmax(0,1fr)] lg:gap-10 xl:gap-12">
      <nav
        aria-label="内容档案索引"
        className="flex gap-1 border-b border-border pb-3 lg:block lg:border-r lg:border-b-0 lg:pr-4 lg:pb-0"
      >
        {[
          { key: "articles", label: "文章", to: "/articles" },
          { key: "categories", label: "分类", to: "/articles/categories" },
          { key: "tags", label: "标签", to: "/articles/tags" },
        ].map((item) => (
          <Link
            key={item.key}
            to={item.to}
            search={item.key === "articles" ? {} : undefined}
            aria-current={page === item.key ? "page" : undefined}
            className={cn(
              "block min-h-11 border-l-2 border-transparent px-4 py-2.5 font-display text-lg transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none lg:mb-3",
              page === item.key && "border-primary bg-primary/7 text-primary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ArticleArchiveHeading({
  title,
  subtitle,
  action,
  meta,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="studio-kicker mb-3">02 / ARCHIVE</p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h1 className="studio-title">{title}</h1>
          <span className="hidden border-l border-border pl-6 font-display text-xs tracking-[0.2em] text-muted-foreground sm:block">
            {subtitle}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-5">
        {meta}
        {action}
      </div>
    </header>
  );
}

export { ArticleArchiveHeading, ArticleArchiveLayout };
