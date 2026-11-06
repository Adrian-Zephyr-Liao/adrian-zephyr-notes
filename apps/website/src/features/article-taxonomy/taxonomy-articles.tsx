import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ArticleListResponse } from "@adrian-zephyr-notes/contracts";

import {
  PageBackLink,
  PageEmptyState,
  PageHeader,
  PagePagination,
  PageShell,
} from "@/components/site/page-shell";
import { ArticleCard } from "@/entities/article";
import { TaxonomyFooter } from "./taxonomy-footer";

function TaxonomyArticles({
  kind,
  slug,
  title,
  description,
  count,
  articles,
}: {
  kind: "category" | "tag";
  slug: string;
  title: string;
  description?: string | null;
  count: number;
  articles: ArticleListResponse;
}) {
  const directory = kind === "category" ? "/categories" : "/tags";
  const basePath = `${directory}/${encodeURIComponent(slug)}`;
  const { page, totalPages } = articles.pagination;
  return (
    <PageShell>
      <PageBackLink href={directory}>
        {kind === "category" ? "返回分类目录" : "返回标签浏览"}
      </PageBackLink>
      <PageHeader
        eyebrow={kind === "category" ? "Topic notes" : "Filed under"}
        title={
          kind === "tag" ? (
            <>
              <span className="font-display text-primary italic" aria-hidden="true">
                #{" "}
              </span>
              {title}
            </>
          ) : (
            title
          )
        }
        description={
          description ??
          (kind === "category"
            ? "这里收录这个主题下的公开文章与持续更新的思考。"
            : `围绕「${title}」展开的思考与实践，收在这里。`)
        }
      >
        <p className="text-[0.85rem] text-primary">共 {count} 篇公开文章</p>
      </PageHeader>
      {articles.data.length === 0 ? (
        <PageEmptyState
          title={page > 1 ? "这一页暂时没有文章" : "这个主题，正在等待下一篇"}
          description={
            page > 1
              ? "文章数量可能发生了变化，可以回到第一页继续浏览。"
              : "新的文章发布后，会自动收录在这里。"
          }
        >
          <Link
            href={page > 1 ? basePath : directory}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            {page > 1 ? "回到第一页" : kind === "category" ? "浏览其他分类" : "浏览其他标签"}{" "}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </PageEmptyState>
      ) : (
        <section
          className={
            articles.data.length === 1
              ? "grid"
              : "grid grid-cols-3 gap-x-7 gap-y-12 max-[1000px]:grid-cols-2 max-[1000px]:gap-x-6 max-[1000px]:gap-y-10 max-[680px]:grid-cols-1"
          }
          aria-label={`${title}的文章`}
        >
          {articles.data.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              heading="h2"
              layout={articles.data.length === 1 ? "feature" : "cover"}
            />
          ))}
        </section>
      )}
      {articles.data.length > 0 ? (
        <PagePagination
          page={page}
          totalPages={totalPages}
          basePath={basePath}
          label={kind === "category" ? "分类文章分页" : "标签文章分页"}
        />
      ) : null}
      <TaxonomyFooter href="/archives" label="去归档，看看所有笔记" />
    </PageShell>
  );
}

export { TaxonomyArticles };
