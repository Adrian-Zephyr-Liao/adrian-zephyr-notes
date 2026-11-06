import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ArticleTagListResponse } from "@adrian-zephyr-notes/contracts";

import {
  PageEmptyState,
  PageHeader,
  PagePagination,
  PageShell,
} from "@/components/site/page-shell";
import { cn } from "@/lib/utils";
import { TaxonomyFooter } from "./taxonomy-footer";

function TagDirectory({ tags }: { tags: ArticleTagListResponse }) {
  const { page, totalPages, totalItems } = tags.pagination;
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tags"
        title="标签浏览"
        description="一些关键词，把散落的笔记串在一起。选一个，看看它通向哪里。"
      />
      <div className="mb-6 flex flex-wrap justify-between gap-4 text-[0.85rem] text-muted-foreground">
        <p>共 {totalItems} 个公开标签</p>
        <span>沿着好奇心，随手翻翻。</span>
      </div>
      {tags.data.length === 0 ? (
        <PageEmptyState
          title={page > 1 ? "这一页暂时没有标签" : "关键词，正在慢慢积累"}
          description={
            page > 1
              ? "回到第一页，继续发现感兴趣的主题。"
              : "文章发布后，使用过的标签会收录在这里。"
          }
        >
          <Link
            href={page > 1 ? "/tags" : "/archives"}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            {page > 1 ? "回到第一页" : "逛逛文章归档"} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </PageEmptyState>
      ) : (
        <section
          className="flex flex-wrap items-baseline gap-x-8 gap-y-2 pt-4 pb-10 max-[680px]:gap-x-5 max-[680px]:pt-0"
          aria-label="文章标签"
        >
          {tags.data.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${encodeURIComponent(tag.slug)}`}
              className={cn(
                "inline-flex max-w-full items-baseline gap-2 border-b border-border py-[0.8rem] leading-normal text-foreground transition-[color,border-color] duration-180 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary",
                tag.publishedArticleCount >= 5
                  ? "text-[2rem] max-[680px]:text-[1.65rem]"
                  : tag.publishedArticleCount >= 2
                    ? "text-2xl max-[680px]:text-xl"
                    : "text-base",
              )}
              aria-label={`${tag.name}，${tag.publishedArticleCount} 篇文章`}
            >
              <span className="font-display text-primary italic opacity-70" aria-hidden="true">
                #
              </span>
              <span className="wrap-anywhere">{tag.name}</span>
              <span className="self-start font-mono text-[0.68rem] text-primary tabular-nums">
                {tag.publishedArticleCount}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                size={16}
                className="shrink-0 self-center text-muted-foreground"
              />
            </Link>
          ))}
        </section>
      )}
      {tags.data.length > 0 ? (
        <PagePagination page={page} totalPages={totalPages} basePath="/tags" label="标签目录分页" />
      ) : null}
      <TaxonomyFooter href="/categories" label="按分类，读得更深入一点" />
    </PageShell>
  );
}

export { TagDirectory };
