import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, FileText, Hash } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArticles, getArticleTagBySlug } from "@/lib/articles-api";

type TagPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 8;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getArticleTagBySlug(slug);
  return tag
    ? { title: `${tag.name} | Adrian Zephyr Notes`, description: `浏览 ${tag.name} 标签下的文章。` }
    : { title: "标签不存在 | Adrian Zephyr Notes" };
}

async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = normalizePage(query.page);
  const [tag, articles] = await Promise.all([
    getArticleTagBySlug(slug),
    getArticles({ page, pageSize: PAGE_SIZE, tag: slug }),
  ]);

  if (!tag) notFound();

  return (
    <main className="flex-1 px-3 pb-14 sm:px-4">
      <header className="border-b border-(--glass-border)">
        <div className="mx-auto grid min-h-56 w-full max-w-[1180px] content-center gap-5 py-8 sm:min-h-64 sm:py-10">
          <Link
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            href="/tags"
          >
            <ArrowLeft className="size-4" />
            返回标签墙
          </Link>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Hash className="size-4" />
              文章标签
            </div>
            <h1 className="text-3xl/tight font-black tracking-normal wrap-anywhere text-foreground sm:text-5xl">
              {tag.name}
            </h1>
            <p className="text-sm font-semibold text-foreground">
              共 {tag.publishedArticleCount} 篇公开文章
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[900px] gap-5 pt-6 sm:pt-8">
        {articles.data.length === 0 ? (
          <div className="border-y border-(--glass-border) py-12 text-center text-sm text-muted-foreground">
            这个标签暂时没有公开文章。
          </div>
        ) : (
          <GlassPanel tone="strong" className="overflow-hidden rounded-2xl p-0">
            <div className="divide-y divide-(--glass-border)">
              {articles.data.map((article) => (
                <article key={article.id} className="grid gap-3 p-4 sm:px-6 sm:py-5">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-primary" />
                      {formatDate(article.publishedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5 text-primary" />
                      {article.wordCount.toLocaleString("zh-CN")} 字
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5 text-primary" />
                      {article.readingMinutes} 分钟
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <h2 className="text-xl/tight font-black tracking-normal wrap-anywhere text-foreground sm:text-2xl">
                      <Link className="hover:text-primary" href={`/posts/${article.slug}`}>
                        {article.title}
                      </Link>
                    </h2>
                    <p className="text-sm leading-7 text-muted-foreground">{article.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {article.tags.slice(0, 5).map((item) => (
                        <Badge
                          key={item.slug}
                          variant={item.slug === tag.slug ? "secondary" : "outline"}
                        >
                          {item.name}
                        </Badge>
                      ))}
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/posts/${article.slug}`}>
                        阅读文章
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </GlassPanel>
        )}
        <Pagination
          page={articles.pagination.page}
          slug={tag.slug}
          totalPages={articles.pagination.totalPages}
        />
      </section>
    </main>
  );
}

function Pagination({
  page,
  slug,
  totalPages,
}: {
  page: number;
  slug: string;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="标签文章分页" className="flex items-center justify-center gap-2">
      <Button asChild={page > 1} disabled={page <= 1} size="sm" variant="outline">
        {page > 1 ? (
          <Link href={`/tags/${slug}?page=${page - 1}`}>上一页</Link>
        ) : (
          <span>上一页</span>
        )}
      </Button>
      <span className="min-w-20 text-center text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button asChild={page < totalPages} disabled={page >= totalPages} size="sm" variant="outline">
        {page < totalPages ? (
          <Link href={`/tags/${slug}?page=${page + 1}`}>下一页</Link>
        ) : (
          <span>下一页</span>
        )}
      </Button>
    </nav>
  );
}

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default TagPage;
