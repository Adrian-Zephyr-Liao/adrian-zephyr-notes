import Link from "next/link";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FileText,
  FolderOpen,
  Layers3,
  Repeat2,
  Sparkles,
  Tag,
} from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { StatusIllustration } from "@/components/status/status-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function ArticleListSection({ articles }: { articles: ArticleListItemResponse[] }) {
  const [featuredArticle, ...otherArticles] = articles;

  return (
    <section
      id="articles"
      className="mx-auto grid w-[min(1180px,calc(100vw-1.5rem))] scroll-mt-24 gap-5 py-8 sm:w-[min(1180px,calc(100vw-2rem))] sm:py-10"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-2">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">Latest</p>
          <h2 className="text-2xl/tight font-black tracking-normal text-foreground sm:text-3xl">
            最近更新
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            从最新一篇进入，再按时间继续浏览技术笔记、工程实践和主题归档。
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/archives">
            查看归档
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {!featuredArticle ? (
        <GlassPanel className="grid justify-items-center gap-4 rounded-3xl p-6 text-center">
          <StatusIllustration className="max-w-[13rem]" variant="empty-articles" />
          <div className="grid gap-1">
            <h3 className="text-base font-black text-foreground">还没有已发布文章</h3>
            <p className="text-sm text-muted-foreground">有文章后会自动出现在这里。</p>
          </div>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
          <FeaturedArticleCard article={featuredArticle} />
          <div className="grid gap-3">
            {otherArticles.length === 0 ? (
              <GlassPanel className="grid min-h-56 content-center gap-2 rounded-3xl p-5 text-sm text-muted-foreground">
                <p className="font-black text-foreground">更多文章正在整理中</p>
                <p>下一篇上线后会自动补充到这条阅读列表里。</p>
              </GlassPanel>
            ) : (
              otherArticles.map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index + 2} />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FeaturedArticleCard({ article }: { article: ArticleListItemResponse }) {
  return (
    <GlassPanel
      tone="strong"
      className="relative isolate grid min-h-[28rem] content-between overflow-hidden rounded-3xl p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_16%,color-mix(in_oklch,var(--primary),transparent_70%),transparent_30%),radial-gradient(circle_at_78%_82%,color-mix(in_oklch,var(--secondary),transparent_58%),transparent_36%),linear-gradient(135deg,color-mix(in_oklch,var(--background),white_20%),var(--background))]"
      />
      <div
        aria-hidden="true"
        className="absolute top-5 right-5 -z-10 size-36 rounded-full border border-dashed border-primary/35"
      />

      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Layers3 className="size-3" />
            最新精选
          </Badge>
          {article.category ? (
            <Badge asChild variant="outline" className="gap-1.5 bg-background/45">
              <Link href={`/categories/${article.category.slug}`}>
                <FolderOpen className="size-3" />
                {article.category.name}
              </Link>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 bg-background/45">
              <FolderOpen className="size-3" />
              未分类
            </Badge>
          )}
          <ArticleOriginBadge article={article} />
        </div>

        <div className="grid gap-3">
          <h3 className="max-w-2xl text-3xl/tight font-black tracking-normal wrap-anywhere text-foreground sm:text-4xl">
            {article.title}
          </h3>
          <p className="max-w-2xl text-sm leading-7 wrap-anywhere text-muted-foreground sm:text-base">
            {article.description}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <ArticleMeta article={article} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {article.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag.slug}
                asChild
                variant="outline"
                className="gap-1.5 bg-background/45 transition-[background-color,border-color,color] duration-150 ease-(--ease-out-ui) hover:border-primary/35 hover:bg-background/70"
              >
                <Link href={`/tags/${tag.slug}`}>
                  <Tag className="size-3" />
                  {tag.name}
                </Link>
              </Badge>
            ))}
          </div>
          <Button asChild>
            <Link href={`/posts/${article.slug}`}>
              阅读精选
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

function ArticleCard({ article, index }: { article: ArticleListItemResponse; index: number }) {
  return (
    <GlassPanel
      tone="interactive"
      className="group/article grid min-h-40 content-between gap-4 rounded-2xl p-4 sm:rounded-3xl sm:p-5"
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-xs font-black text-primary">
            {String(index).padStart(2, "0")}
          </span>
          {article.category ? (
            <Badge
              asChild
              variant="outline"
              className="max-w-[12rem] gap-1.5 truncate bg-background/40"
            >
              <Link href={`/categories/${article.category.slug}`}>
                <FolderOpen className="size-3" />
                <span className="truncate">{article.category.name}</span>
              </Link>
            </Badge>
          ) : (
            <Badge variant="outline" className="max-w-[12rem] gap-1.5 bg-background/40">
              <FolderOpen className="size-3" />
              未分类
            </Badge>
          )}
          <ArticleOriginBadge article={article} />
        </div>

        <div className="grid gap-2">
          <h3 className="text-xl/tight font-black tracking-normal wrap-anywhere text-foreground">
            <Link
              className="transition-colors duration-150 ease-(--ease-out-ui) hover:text-primary"
              href={`/posts/${article.slug}`}
            >
              {article.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm leading-6 wrap-anywhere text-muted-foreground">
            {article.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ArticleMeta article={article} />
        <ArrowRight className="size-4 text-muted-foreground transition-[color,translate] duration-150 ease-(--ease-out-ui) motion-reduce:transition-none motion-reduce:group-hover/article:translate-x-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/article:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover/article:text-primary" />
      </div>
    </GlassPanel>
  );
}

function ArticleOriginBadge({ article }: { article: ArticleListItemResponse }) {
  const isReposted = article.origin === "REPOSTED";
  const Icon = isReposted ? Repeat2 : Sparkles;

  return (
    <Badge variant={isReposted ? "secondary" : "outline"} className="gap-1.5 bg-background/45">
      <Icon className="size-3" />
      {isReposted ? "转载" : "原创"}
    </Badge>
  );
}

function ArticleMeta({ article }: { article: ArticleListItemResponse }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-muted-foreground">
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
  );
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export { ArticleListSection };
