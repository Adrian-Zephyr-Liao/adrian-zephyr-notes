import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, FileText, Tag } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArticles } from "@/lib/articles-api";

type ArchivesPageProps = {
  searchParams: Promise<{ tag?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章归档 | Adrian Zephyr Notes",
  description: "按时间浏览 Adrian Zephyr Notes 的全部公开文章。",
};

async function ArchivesPage({ searchParams }: ArchivesPageProps) {
  const { tag } = await searchParams;
  const articles = await getArticles({ pageSize: 50, tag });

  return (
    <main className="flex-1 px-3 pb-14 sm:px-4">
      <div className="mx-auto grid w-full max-w-[1180px] gap-5 pt-6 sm:pt-10">
        <div className="grid gap-3">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">Archives</p>
          <div className="grid gap-2">
            <h1 className="text-3xl/tight font-black tracking-normal text-foreground sm:text-5xl">
              文章归档
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              按发布时间整理全部公开文章，适合快速回看最近的笔记和长期沉淀的主题。
            </p>
          </div>
          {tag ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Tag className="size-3" />
                当前标签：{tag}
              </Badge>
              <Button asChild variant="ghost" size="sm">
                <Link href="/archives">查看全部</Link>
              </Button>
            </div>
          ) : null}
        </div>

        <GlassPanel tone="strong" className="overflow-hidden rounded-2xl p-0 sm:rounded-3xl">
          {articles.data.length === 0 ? (
            <div className="grid gap-2 p-6 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">暂时没有匹配的文章</p>
              <p>换一个标签，或者回到全部归档继续浏览。</p>
            </div>
          ) : (
            <div className="divide-y divide-(--glass-border)">
              {articles.data.map((article) => (
                <article key={article.id} className="grid gap-3 p-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-primary" />
                      {formatArticleDate(article.publishedAt)}
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
                    <p className="text-sm leading-7 wrap-anywhere text-muted-foreground">
                      {article.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((item) => (
                        <Badge key={item.slug} asChild variant="outline">
                          <Link href={`/tags/${item.slug}`}>{item.name}</Link>
                        </Badge>
                      ))}
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/posts/${article.slug}`}>
                        阅读
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </main>
  );
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default ArchivesPage;
