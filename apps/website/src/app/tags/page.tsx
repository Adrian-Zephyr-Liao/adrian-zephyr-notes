import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Hash } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArticleTags } from "@/lib/articles-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "标签浏览 | Adrian Zephyr Notes",
  description: "按标签浏览 Adrian Zephyr Notes 的文章主题。",
};

type TagsPageProps = { searchParams: Promise<{ page?: string }> };

async function TagsPage({ searchParams }: TagsPageProps) {
  const query = await searchParams;
  const tags = await getArticleTags({ page: normalizePage(query.page), pageSize: 24 });

  return (
    <main className="flex-1 px-3 pb-14 sm:px-4">
      <div className="mx-auto grid w-full max-w-[1180px] gap-5 pt-6 sm:pt-10">
        <div className="grid gap-3">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">Tags</p>
          <div className="grid gap-2">
            <h1 className="text-3xl/tight font-black tracking-normal text-foreground sm:text-5xl">
              标签浏览
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              用标签快速定位主题。标签负责细粒度检索，归档页负责按时间回看。
            </p>
          </div>
        </div>

        {tags.data.length === 0 ? (
          <GlassPanel className="rounded-3xl p-6 text-sm text-muted-foreground">
            还没有可浏览的文章标签。
          </GlassPanel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.data.map((tag) => (
              <Link key={tag.slug} className="group/tag block" href={`/tags/${tag.slug}`}>
                <GlassPanel
                  tone="interactive"
                  className="grid min-h-36 content-between gap-5 rounded-2xl p-5 sm:rounded-3xl"
                >
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Hash className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-[color,translate] duration-150 ease-(--ease-out-ui) motion-reduce:transition-none motion-reduce:group-hover/tag:translate-x-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/tag:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover/tag:text-primary" />
                    </div>
                    <div className="grid gap-1">
                      <h2 className="text-xl font-black tracking-normal text-foreground">
                        {tag.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">浏览这个主题下的公开文章</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{tag.publishedArticleCount} 篇文章</Badge>
                </GlassPanel>
              </Link>
            ))}
          </div>
        )}
        <TagPagination page={tags.pagination.page} totalPages={tags.pagination.totalPages} />
      </div>
    </main>
  );
}

function TagPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="标签目录分页" className="flex items-center justify-center gap-2">
      <Button asChild={page > 1} disabled={page <= 1} size="icon" variant="outline">
        {page > 1 ? (
          <Link aria-label="上一页" href={`/tags?page=${page - 1}`}>
            <ChevronLeft />
          </Link>
        ) : (
          <span>
            <ChevronLeft />
          </span>
        )}
      </Button>
      <span className="min-w-20 text-center text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        asChild={page < totalPages}
        disabled={page >= totalPages}
        size="icon"
        variant="outline"
      >
        {page < totalPages ? (
          <Link aria-label="下一页" href={`/tags?page=${page + 1}`}>
            <ChevronRight />
          </Link>
        ) : (
          <span>
            <ChevronRight />
          </span>
        )}
      </Button>
    </nav>
  );
}

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default TagsPage;
