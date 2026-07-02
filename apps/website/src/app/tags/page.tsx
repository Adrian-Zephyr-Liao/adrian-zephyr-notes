import type { Metadata } from "next";
import Link from "next/link";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import { ArrowRight, Hash } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { getArticles } from "@/lib/articles-api";

type TagSummary = {
  slug: string;
  name: string;
  articleCount: number;
  latestPublishedAt: string;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "标签浏览 | Adrian Zephyr Notes",
  description: "按标签浏览 Adrian Zephyr Notes 的文章主题。",
};

async function TagsPage() {
  const articles = await getArticles({ pageSize: 50 });
  const tags = createTagSummaries(articles.data);

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

        {tags.length === 0 ? (
          <GlassPanel className="rounded-3xl p-6 text-sm text-muted-foreground">
            还没有可浏览的文章标签。
          </GlassPanel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                className="group/tag block"
                href={`/archives?tag=${encodeURIComponent(tag.slug)}`}
              >
                <GlassPanel
                  tone="interactive"
                  className="grid min-h-36 content-between gap-5 rounded-2xl p-5 sm:rounded-3xl"
                >
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Hash className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover/tag:translate-x-0.5 group-hover/tag:text-primary" />
                    </div>
                    <div className="grid gap-1">
                      <h2 className="text-xl font-black tracking-normal text-foreground">
                        {tag.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        最近更新于 {formatArticleDate(tag.latestPublishedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{tag.articleCount} 篇文章</Badge>
                </GlassPanel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function createTagSummaries(articles: ArticleListItemResponse[]) {
  const tagMap = new Map<string, TagSummary>();

  for (const article of articles) {
    for (const tag of article.tags) {
      const current = tagMap.get(tag.slug);

      if (!current) {
        tagMap.set(tag.slug, {
          slug: tag.slug,
          name: tag.name,
          articleCount: 1,
          latestPublishedAt: article.publishedAt,
        });
        continue;
      }

      current.articleCount += 1;

      if (new Date(article.publishedAt).getTime() > new Date(current.latestPublishedAt).getTime()) {
        current.latestPublishedAt = article.publishedAt;
      }
    }
  }

  return [...tagMap.values()].sort((left, right) => {
    if (right.articleCount !== left.articleCount) {
      return right.articleCount - left.articleCount;
    }

    return right.latestPublishedAt.localeCompare(left.latestPublishedAt);
  });
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default TagsPage;
