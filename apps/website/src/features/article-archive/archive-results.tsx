import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { PageEmptyState } from "@/components/site/page-shell";
import { ArticleCard } from "@/entities/article";
import { cn } from "@/lib/utils";
import { archiveHref, type ArchiveQuery } from "./archive-query";
import { archiveActionClassName } from "./styles";

const monthFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  timeZone: "Asia/Shanghai",
});
const yearFormat = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Shanghai" });

function ArchiveResults({
  articles,
  query,
}: {
  articles: ArticleListItemResponse[];
  query: ArchiveQuery;
}) {
  const hasFilters = Boolean(query.q || query.category || query.tag);
  const years = Object.groupBy(articles, (article) =>
    yearFormat.format(new Date(article.publishedAt)),
  );
  const months = Object.groupBy(articles, (article) =>
    monthFormat.format(new Date(article.publishedAt)),
  );
  return (
    <section aria-label="归档文章" className="grid gap-10 pt-8">
      {articles.length === 0 ? (
        <PageEmptyState
          title={
            query.page > 1
              ? "这一页暂时没有文章"
              : hasFilters
                ? "还没有找到这篇笔记"
                : "第一篇笔记，正在路上"
          }
          description={
            query.page > 1
              ? "文章数量可能发生了变化，可以回到第一页继续浏览。"
              : hasFilters
                ? "试试其他关键词，或清除筛选重新看看。"
                : "文章发布后，会按时间收录在这里。"
          }
        >
          <Link
            href={
              query.page > 1
                ? archiveHref(query, { page: 1 })
                : archiveHref(query, { q: null, category: null, tag: null })
            }
            scroll={false}
            className={cn(
              archiveActionClassName,
              "mt-1 border border-border px-[0.85rem] py-2 text-primary [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
            )}
          >
            {query.page > 1 ? "回到第一页" : "查看全部归档"}{" "}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </PageEmptyState>
      ) : query.view === "cover" ? (
        Object.entries(years)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([year, items]) => (
            <section
              key={year}
              className="grid grid-cols-[7rem_minmax(0,1fr)] gap-8 max-[600px]:grid-cols-1 max-[600px]:gap-6"
            >
              <div className="grid content-start gap-3 pt-1 max-[600px]:flex max-[600px]:items-baseline max-[600px]:gap-4">
                <h2 className="font-display text-[2.5rem] leading-none font-semibold italic">
                  {year}
                </h2>
                <span className="text-xs text-muted-foreground">本页 {items?.length ?? 0} 篇</span>
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-8 max-[1050px]:grid-cols-2 max-[600px]:grid-cols-1 max-[600px]:gap-[1.8rem]">
                {(items ?? []).map((article) => (
                  <ArticleCard key={article.id} article={article} layout="archive" />
                ))}
              </div>
            </section>
          ))
      ) : (
        Object.entries(months).map(([month, items]) => (
          <ArchiveMonth key={month} month={month} articles={items ?? []} />
        ))
      )}
    </section>
  );
}

function ArchiveMonth({ month, articles }: { month: string; articles: ArticleListItemResponse[] }) {
  return (
    <section className="relative border-l border-border pl-[1.85rem] max-[600px]:pl-[1.1rem]">
      <div className="mb-[1.2rem] flex flex-wrap items-baseline gap-3">
        <span
          aria-hidden="true"
          className="absolute top-[0.35rem] left-[-0.35rem] size-[0.65rem] rounded-full border-2 border-background bg-primary outline-1 outline-primary"
        />
        <h2 className="text-[1.4rem] leading-[1.3] font-bold max-[600px]:text-[1.2rem]">{month}</h2>
        <span className="text-xs text-muted-foreground">本页 {articles.length} 篇</span>
      </div>
      <div className="grid max-w-[54rem] gap-5">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} layout="timeline" heading="h3" />
        ))}
      </div>
    </section>
  );
}

export { ArchiveResults };
