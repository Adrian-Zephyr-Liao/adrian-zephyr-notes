"use client";

import { useState } from "react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { ArticleCard } from "@/entities/article";
import { cn } from "@/lib/utils";

function RecentArticles({ articles }: { articles: ArticleListItemResponse[] }) {
  const [category, setCategory] = useState<string | null>(null);
  const categories = Array.from(
    new Map(
      articles.flatMap((article) =>
        article.category ? [[article.category.slug, article.category] as const] : [],
      ),
    ).values(),
  );
  const filtered = category
    ? articles.filter((article) => article.category?.slug === category)
    : articles;
  const lead =
    filtered.find((article) => article.category?.slug === "agent-engineering") ?? filtered[0];
  const rest = filtered.filter((article) => article.id !== lead?.id);

  return (
    <>
      <fieldset
        className="mt-6 mb-8 flex min-w-0 flex-wrap items-center gap-x-7 gap-y-2 border-b border-border max-[680px]:mt-4 max-[680px]:gap-x-3"
        aria-label="筛选近期文章"
      >
        {[{ slug: null, name: "全部" }, ...categories].map((item) => (
          <button
            key={item.slug ?? "all"}
            type="button"
            aria-label={item.name}
            aria-pressed={category === item.slug}
            onClick={() => setCategory(item.slug)}
            className={cn(
              "relative inline-flex min-h-14 cursor-pointer items-center px-1 text-base text-foreground after:ml-7 after:text-border after:content-['/'] last:after:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary max-[680px]:min-h-12 max-[680px]:text-[0.8rem] max-[680px]:after:ml-3",
              category === item.slug &&
                "text-primary before:absolute before:right-8 before:-bottom-px before:left-0 before:h-[3px] before:rounded-[3px] before:bg-primary before:content-[''] last:before:right-0",
            )}
          >
            {item.name}
          </button>
        ))}
      </fieldset>
      <p className="sr-only" aria-live="polite">
        显示 {filtered.length} 篇近期文章
      </p>
      {lead ? (
        <>
          <div className="grid grid-cols-[minmax(0,1.16fr)_minmax(0,0.84fr)] items-start gap-8 max-[850px]:grid-cols-1">
            <ArticleCard article={lead} layout="lead" />
            <div className="grid content-start gap-7 max-[850px]:grid-cols-2 max-[680px]:grid-cols-1 max-[680px]:gap-6 max-[680px]:border-t max-[680px]:border-border max-[680px]:pt-6">
              {rest.slice(0, 2).map((article) => (
                <ArticleCard key={article.id} article={article} layout="compact" />
              ))}
            </div>
          </div>
          {rest.length > 2 ? (
            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-12 border-t border-border pt-10 max-[680px]:mt-7 max-[680px]:grid-cols-1 max-[680px]:pt-7">
              {rest.slice(2).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export { RecentArticles };
