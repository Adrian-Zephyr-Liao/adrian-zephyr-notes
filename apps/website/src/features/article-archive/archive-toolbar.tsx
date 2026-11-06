import Form from "next/form";
import Link from "next/link";
import { ArrowRight, ChevronDown, LayoutGrid, ListTree, Search, X } from "lucide-react";
import type { ArticleCategoryDetailResponse } from "@adrian-zephyr-notes/contracts";

import { cn } from "@/lib/utils";
import { archiveHref, type ArchiveQuery } from "./archive-query";
import { archiveActionClassName, archiveFieldClassName } from "./styles";

function ArchiveToolbar({
  categories,
  query,
}: {
  categories: ArticleCategoryDetailResponse[];
  query: ArchiveQuery;
}) {
  const hasFilters = Boolean(query.q || query.category || query.tag);
  const categoryName = categories.find((category) => category.slug === query.category)?.name;
  return (
    <section className="border-b border-border pt-3 pb-6" aria-label="查找归档文章">
      <div className="flex items-center gap-6 max-[1050px]:flex-wrap max-[1050px]:gap-4">
        <Form
          action="/archives"
          scroll={false}
          className="flex min-w-0 flex-1 gap-[0.65rem] max-[1050px]:basis-full max-[600px]:flex-wrap"
        >
          <label
            className={cn(
              archiveFieldClassName,
              "flex-1 gap-[0.6rem] px-[0.8rem] text-muted-foreground max-[600px]:basis-full",
            )}
          >
            <span className="sr-only">搜索文章</span>
            <Search aria-hidden="true" size={19} className="shrink-0" />
            <input
              key={query.q ?? ""}
              type="search"
              id="archive-search"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="搜索标题、内容、关键词…"
              className="w-full min-w-0 scroll-mt-32 border-0 bg-transparent py-[0.65rem] text-[0.9rem] text-foreground outline-0 placeholder:text-muted-foreground max-[600px]:text-base"
            />
          </label>
          <label
            className={cn(archiveFieldClassName, "relative flex-[0_1_11rem] max-[600px]:flex-1")}
          >
            <span className="sr-only">文章分类</span>
            <select
              key={query.category ?? ""}
              name="category"
              defaultValue={query.category ?? ""}
              className="min-h-[2.85rem] w-full cursor-pointer appearance-none border-0 bg-transparent py-[0.6rem] pr-8 pl-[0.85rem] text-[0.9rem] text-foreground outline-0 max-[600px]:text-base [&_option]:bg-background [&_option]:text-foreground"
            >
              <option value="">全部分类</option>
              {query.category && !categoryName ? (
                <option value={query.category}>{query.category}</option>
              ) : null}
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute right-[0.7rem] shrink-0"
            />
          </label>
          {query.tag ? <input type="hidden" name="tag" value={query.tag} /> : null}
          {query.view === "timeline" ? <input type="hidden" name="view" value="timeline" /> : null}
          <button
            type="submit"
            className={cn(
              archiveActionClassName,
              "shrink-0 cursor-pointer border border-primary bg-primary px-[0.85rem] py-[0.55rem] text-primary-foreground max-[600px]:px-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/90",
            )}
          >
            查找 <ArrowRight aria-hidden="true" size={17} />
          </button>
        </Form>
        <nav
          className="flex shrink-0 gap-[0.3rem] border-l border-border pl-5 max-[1050px]:border-l-0 max-[1050px]:pl-0"
          aria-label="文章显示方式"
        >
          <Link
            href={archiveHref(query, { view: "cover" })}
            scroll={false}
            aria-current={query.view === "cover" ? "true" : undefined}
            className={cn(
              archiveActionClassName,
              "px-[0.85rem] py-[0.55rem] text-muted-foreground aria-current:bg-primary aria-current:text-primary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary",
            )}
          >
            <LayoutGrid aria-hidden="true" size={17} />
            封面
          </Link>
          <Link
            href={archiveHref(query, { view: "timeline" })}
            scroll={false}
            aria-current={query.view === "timeline" ? "true" : undefined}
            className={cn(
              archiveActionClassName,
              "px-[0.85rem] py-[0.55rem] text-muted-foreground aria-current:bg-primary aria-current:text-primary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary",
            )}
          >
            <ListTree aria-hidden="true" size={18} />
            时间线
          </Link>
        </nav>
      </div>
      {hasFilters ? (
        <div className="mt-[0.85rem] flex flex-wrap items-center gap-x-[0.8rem] gap-y-[0.6rem] text-[0.82rem] text-muted-foreground">
          <span>当前筛选</span>
          {query.q ? (
            <FilterLink href={archiveHref(query, { q: null })} label={`关键词：${query.q}`} />
          ) : null}
          {query.category ? (
            <FilterLink
              href={archiveHref(query, { category: null })}
              label={`分类：${categoryName ?? query.category}`}
            />
          ) : null}
          {query.tag ? (
            <FilterLink href={archiveHref(query, { tag: null })} label={`标签：${query.tag}`} />
          ) : null}
          <Link
            href={archiveHref(query, { q: null, category: null, tag: null })}
            scroll={false}
            className="ml-auto inline-flex min-h-[2.1rem] items-center underline underline-offset-4 outline-offset-4 focus-visible:outline-[3px] focus-visible:outline-ring active:translate-y-px motion-reduce:active:translate-y-0 max-[600px]:ml-0"
          >
            清除筛选
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function FilterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`移除${label}`}
      className="inline-flex min-h-[2.1rem] max-w-full items-center gap-[0.4rem] text-primary underline-offset-4 outline-offset-4 hover:underline focus-visible:outline-[3px] focus-visible:outline-ring active:translate-y-px motion-reduce:active:translate-y-0"
    >
      <span className="wrap-anywhere">{label}</span>
      <X aria-hidden="true" size={14} className="shrink-0" />
    </Link>
  );
}

export { ArchiveToolbar };
