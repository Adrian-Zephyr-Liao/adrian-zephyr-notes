import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderOpen } from "lucide-react";
import type {
  ArticleCategoryDetailResponse,
  ArticleListItemResponse,
} from "@adrian-zephyr-notes/contracts";

import { PageEmptyState, PageHeader, PageShell } from "@/components/site/page-shell";
import { ArticleCover } from "@/entities/article";
import { TaxonomyFooter } from "./taxonomy-footer";

type CategoryEntry = {
  category: ArticleCategoryDetailResponse;
  article: ArticleListItemResponse | null;
};

function CategoryDirectory({ categories }: { categories: CategoryEntry[] }) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Categories"
        title="分类目录"
        description="从一个感兴趣的主题开始，读到下一篇。"
      />
      {categories.length === 0 ? (
        <PageEmptyState
          title="内容正在慢慢成形"
          description="有公开文章后，对应的主题会出现在这里。"
        >
          <FolderOpen aria-hidden="true" size={30} strokeWidth={1.3} />
          <Link
            href="/archives"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            逛逛文章归档 <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </PageEmptyState>
      ) : (
        <section
          aria-label="文章分类"
          className="grid grid-cols-3 gap-x-8 gap-y-12 max-[1000px]:grid-cols-2 max-[1000px]:gap-x-6 max-[1000px]:gap-y-10 max-[680px]:grid-cols-1"
        >
          {categories.map(({ category, article }, index) => (
            <article key={category.slug}>
              <Link
                className="group/category grid h-full gap-6 rounded-[0.85rem] outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary max-[680px]:gap-4"
                href={`/categories/${encodeURIComponent(category.slug)}`}
              >
                <div className="relative overflow-hidden rounded-[0.85rem] bg-muted [&_img]:transition-transform [&_img]:duration-600 [&_img]:ease-(--ease-out-ui) motion-reduce:[&_img]:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/category:[&_img]:scale-[1.045]">
                  {article ? (
                    <ArticleCover article={article} />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-accent text-primary">
                      <FolderOpen aria-hidden="true" size={42} strokeWidth={1.2} />
                    </div>
                  )}
                  <span
                    className="absolute top-[0.8rem] left-[0.9rem] font-display text-[1.8rem] leading-none text-[#fff3dc] italic text-shadow-[0_1px_8px_#0e1c2480]"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight
                    className="absolute right-[0.85rem] bottom-[0.85rem] size-9 rounded-full bg-background p-[0.4rem] text-foreground transition-[transform,background-color,color] duration-200 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/category:bg-primary [@media(hover:hover)_and_(pointer:fine)]:group-hover/category:text-primary-foreground motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/category:rotate-[8deg]"
                    aria-hidden="true"
                    size={22}
                  />
                </div>
                <div className="grid content-start gap-[0.9rem]">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-2xl/normal font-bold wrap-anywhere transition-colors duration-200 group-focus-visible/category:text-primary motion-reduce:transition-none max-[680px]:text-[1.35rem] [@media(hover:hover)_and_(pointer:fine)]:group-hover/category:text-primary">
                      {category.name}
                    </h2>
                    <span className="shrink-0 text-[0.8rem] text-primary">
                      {category.publishedArticleCount} 篇
                    </span>
                  </div>
                  <p className="text-[0.9rem] leading-[1.9] wrap-anywhere text-muted-foreground">
                    {category.description ?? "在这个主题里，收集思考与实践的片段。"}
                  </p>
                  <span className="mt-[0.4rem] inline-flex items-center gap-[0.6rem] text-[0.8rem]">
                    沿着主题读下去 <ArrowRight aria-hidden="true" size={16} />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </section>
      )}
      <TaxonomyFooter href="/tags" label="也可以从标签里找灵感" />
    </PageShell>
  );
}

export { CategoryDirectory };
