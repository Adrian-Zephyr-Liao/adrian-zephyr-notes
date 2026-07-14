import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { getArticleCategories } from "@/lib/articles-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分类目录 | Adrian Zephyr Notes",
  description: "按分类浏览 Adrian Zephyr Notes 的公开文章。",
};

async function CategoriesPage() {
  const categories = await getArticleCategories();

  return (
    <main className="flex-1 px-3 pb-14 sm:px-4">
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 pt-6 sm:pt-10">
        <header className="grid gap-3 border-b border-(--glass-border) pb-6">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">Categories</p>
          <div className="grid gap-2">
            <h1 className="text-3xl/tight font-black tracking-normal text-foreground sm:text-5xl">
              分类目录
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              分类负责组织长期内容方向，标签则用于更细粒度的主题检索。
            </p>
          </div>
        </header>

        {categories.data.length === 0 ? (
          <div className="border-y border-(--glass-border) py-12 text-center text-sm text-muted-foreground">
            还没有包含公开文章的分类。
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.data.map((category) => (
              <Link
                key={category.slug}
                className="group/category block"
                href={`/categories/${category.slug}`}
              >
                <GlassPanel
                  className="grid min-h-40 content-between gap-5 rounded-2xl p-5"
                  tone="interactive"
                >
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <FolderOpen className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-[color,translate] duration-150 ease-(--ease-out-ui) motion-reduce:transition-none motion-reduce:group-hover/category:translate-x-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/category:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover/category:text-primary" />
                    </div>
                    <div className="grid gap-1.5">
                      <h2 className="text-xl font-black tracking-normal text-foreground">
                        {category.name}
                      </h2>
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {category.description ?? "浏览该分类下的全部公开文章。"}
                      </p>
                    </div>
                  </div>
                  <Badge className="w-fit" variant="secondary">
                    {category.publishedArticleCount} 篇文章
                  </Badge>
                </GlassPanel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default CategoriesPage;
