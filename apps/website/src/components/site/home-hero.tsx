import Image from "next/image";
import Link from "next/link";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import { ArrowRight, CalendarDays, Feather, MessageCircle, Sparkles } from "lucide-react";

import { CuteIcon, type CuteIconName } from "@/components/primitives/cute-icon";
import { GlassPanel } from "@/components/primitives/glass-panel";
import { GradientText } from "@/components/primitives/gradient-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteAssets } from "@/lib/site-assets";
import styles from "./home-effects.module.css";

type HeroFeature = {
  icon: CuteIconName;
  label: string;
  tone: string;
};

const heroFeatures = [
  {
    icon: "book-6-ai-line",
    label: "读最新",
    tone: "bg-primary/12 text-primary",
  },
  {
    icon: "notebook-line",
    label: "找主题",
    tone: "bg-[oklch(0.9_0.07_164)] text-[oklch(0.42_0.11_164)] dark:bg-[oklch(0.32_0.06_164)] dark:text-[oklch(0.82_0.09_164)]",
  },
  {
    icon: "horn-line",
    label: "可交流",
    tone: "bg-[oklch(0.93_0.06_78)] text-[oklch(0.48_0.11_78)] dark:bg-[oklch(0.3_0.05_78)] dark:text-[oklch(0.86_0.09_78)]",
  },
] satisfies readonly HeroFeature[];

const readingSignals = [
  {
    icon: "notebook-line",
    label: "深度阅读",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
  {
    icon: "terminal-box-line",
    label: "代码片段",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
  {
    icon: "book-6-ai-line",
    label: "主题归档",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
] satisfies readonly HeroFeature[];

const floatingNotes = [
  "left-[6%] top-[18%] [--note-rotation:-8deg] [animation-delay:0.2s]",
  "left-[78%] top-[16%] [--note-rotation:7deg] [animation-delay:1.4s]",
  "left-[12%] top-[72%] [--note-rotation:5deg] [animation-delay:2.3s]",
  "left-[84%] top-[66%] [--note-rotation:-6deg] [animation-delay:0.8s]",
] as const;

function HomeHero({ articles }: { articles: ArticleListItemResponse[] }) {
  const latestArticle = articles[0] ?? null;
  const stats = createHomeStats(articles);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-[min(1180px,calc(100vw-1.5rem))] items-center py-8 sm:w-[min(1180px,calc(100vw-2rem))] sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)] lg:items-stretch">
        <GlassPanel
          tone="strong"
          className="relative isolate overflow-hidden rounded-3xl px-5 py-7 sm:px-7 sm:py-9 lg:p-10"
        >
          <div className={cn(styles.heroPaperGrid, "absolute inset-0 -z-10")} />
          <div className={cn(styles.heroRoute, "absolute right-4 bottom-8 hidden lg:block")} />

          <div className="grid h-full content-between gap-8">
            <div className="grid gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--glass-border) bg-background/55 px-3 py-1.5 text-sm font-semibold text-muted-foreground backdrop-blur">
                <Sparkles className="size-4 text-primary" />
                Adrian Zephyr Notes
              </div>

              <div className="grid gap-4">
                <h1 className="max-w-4xl text-4xl/tight font-black tracking-normal text-balance wrap-anywhere sm:text-6xl">
                  从最新笔记开始，进入一张 <GradientText>可继续探索的技术地图</GradientText>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  这里收录前端工程、服务端设计、产品体验和长期可复用的技术判断。你可以先读最新文章，也可以按主题回看完整归档。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {heroFeatures.map((feature) => (
                  <span
                    key={feature.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-(--glass-border) bg-background/50 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur dark:bg-white/5"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-full ${feature.tone}`}
                    >
                      <CuteIcon name={feature.icon} className="size-3.5" />
                    </span>
                    {feature.label}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link href="#articles">
                    浏览文章
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/comments">
                    去留言
                    <MessageCircle className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-(--glass-border) bg-background/45 p-3 backdrop-blur"
                >
                  <p className="text-xs font-bold text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xl font-black text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-5">
          <GlassPanel className="relative isolate min-h-[26rem] overflow-hidden rounded-3xl p-0">
            <div className={cn(styles.studioGlow, "absolute inset-0 -z-10")} />
            <div className={cn(styles.studioOrbit, "absolute top-6 right-6 size-28")} />
            {floatingNotes.map((className) => (
              <span
                key={className}
                aria-hidden="true"
                className={cn(styles.floatingNote, "absolute z-20 h-12 w-10 rounded-xl", className)}
              />
            ))}
            <Image
              priority
              alt="原创博客阅读插画，包含技术文章、代码卡片和便签角色"
              src={siteAssets.blogHeroIllustration}
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 34rem, calc(100vw - 2rem)"
              className="h-[26rem] w-full object-cover sm:h-[30rem] lg:h-full"
            />

            <div className="absolute inset-x-4 bottom-4 z-30 flex flex-wrap gap-2">
              {readingSignals.map((signal) => (
                <span
                  key={signal.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-(--glass-border) px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur-xl ${signal.tone}`}
                >
                  <CuteIcon name={signal.icon} className="size-3.5 text-primary" />
                  {signal.label}
                </span>
              ))}
            </div>

            {latestArticle ? <LatestArticleRibbon article={latestArticle} /> : null}
          </GlassPanel>

          <ReadingRail latestArticle={latestArticle} />
        </div>
      </div>
    </section>
  );
}

function LatestArticleRibbon({ article }: { article: ArticleListItemResponse }) {
  return (
    <Link
      href={`/posts/${article.slug}`}
      className="group/ribbon absolute inset-x-4 top-4 z-30 block rounded-2xl border border-(--glass-border) bg-background/72 p-3 shadow-(--shadow-glass) backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/35 sm:left-auto sm:w-72"
    >
      <p className="flex items-center gap-1.5 text-xs font-black tracking-[0.16em] text-primary uppercase">
        <Feather className="size-3.5" />
        {article.origin === "REPOSTED" ? "最新转载" : "最新原创"}
      </p>
      <h2 className="mt-2 line-clamp-2 text-base/tight font-black tracking-normal text-foreground">
        {article.title}
      </h2>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarDays className="size-3.5 text-primary" />
        {formatArticleDate(article.publishedAt)}
        <ArrowRight className="ml-auto size-3.5 transition group-hover/ribbon:translate-x-0.5" />
      </p>
    </Link>
  );
}

function ReadingRail({ latestArticle }: { latestArticle: ArticleListItemResponse | null }) {
  const railItems = [
    {
      href: latestArticle ? `/posts/${latestArticle.slug}` : "#articles",
      label: "先读",
      value: latestArticle ? "最新文章" : "等待更新",
    },
    {
      href: "/tags",
      label: "再找",
      value: "主题标签",
    },
    {
      href: "/comments",
      label: "交流",
      value: "留言板",
    },
  ];

  return (
    <GlassPanel className="overflow-hidden rounded-3xl p-4">
      <div className="grid grid-cols-3 gap-2">
        {railItems.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className="relative grid gap-2 rounded-2xl bg-background/40 p-3 transition hover:bg-background/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {index < railItems.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-6 right-[-0.55rem] z-10 hidden h-px w-4 bg-primary/45 sm:block"
              />
            ) : null}
            <span className="grid size-7 place-items-center rounded-xl bg-primary/12 text-xs font-black text-primary">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 truncate text-sm font-black text-foreground">{item.value}</p>
            </div>
          </Link>
        ))}
      </div>
    </GlassPanel>
  );
}

function createHomeStats(articles: ArticleListItemResponse[]) {
  const tags = new Set<string>();
  const categories = new Set<string>();

  for (const article of articles) {
    if (article.category) {
      categories.add(article.category.slug);
    }

    for (const tag of article.tags) {
      tags.add(tag.slug);
    }
  }

  return [
    {
      label: "文章",
      value: String(articles.length),
    },
    {
      label: "主题",
      value: String(categories.size),
    },
    {
      label: "标签",
      value: String(tags.size),
    },
  ];
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export { HomeHero };
