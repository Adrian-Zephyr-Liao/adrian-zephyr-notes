import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CuteIcon, type CuteIconName } from "@/components/primitives/cute-icon";
import { GlassPanel } from "@/components/primitives/glass-panel";
import { GradientText } from "@/components/primitives/gradient-text";
import { Button } from "@/components/ui/button";
import { siteAssets } from "@/lib/site-assets";

type HeroFeature = {
  icon: CuteIconName;
  label: string;
  tone: string;
};

const heroFeatures = [
  {
    icon: "book-6-ai-line",
    label: "长文阅读",
    tone: "bg-primary/12 text-primary",
  },
  {
    icon: "code-line",
    label: "代码高亮",
    tone: "bg-[oklch(0.9_0.07_164)] text-[oklch(0.42_0.11_164)] dark:bg-[oklch(0.32_0.06_164)] dark:text-[oklch(0.82_0.09_164)]",
  },
  {
    icon: "palette-2-line",
    label: "玻璃拟态",
    tone: "bg-[oklch(0.93_0.06_78)] text-[oklch(0.48_0.11_78)] dark:bg-[oklch(0.3_0.05_78)] dark:text-[oklch(0.86_0.09_78)]",
  },
] satisfies readonly HeroFeature[];

const readingSignals = [
  {
    icon: "notebook-line",
    label: "Markdown",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
  {
    icon: "terminal-box-line",
    label: "Shiki",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
  {
    icon: "sparkles-2-line",
    label: "Motion",
    tone: "bg-white/70 text-foreground dark:bg-white/10 dark:text-foreground",
  },
] satisfies readonly HeroFeature[];

function HomeHero() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-[min(1180px,calc(100vw-1.5rem))] items-center py-10 sm:w-[min(1180px,calc(100vw-2rem))]">
      <GlassPanel
        tone="strong"
        className="relative overflow-hidden rounded-3xl px-5 py-8 sm:px-8 lg:p-12"
      >
        <div className="absolute inset-0 -z-10 bg-(image:--gradient-brand) opacity-10" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:items-center">
          <div className="grid gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/55 px-3 py-1.5 text-sm font-semibold text-muted-foreground dark:bg-white/10">
              <CuteIcon name="sparkles-2-line" className="text-primary" />
              Personal blog reading system
            </div>

            <div className="grid gap-4">
              <h1 className="max-w-4xl text-4xl/tight font-black tracking-normal text-balance wrap-anywhere sm:text-6xl">
                一版更像主题站的 <GradientText>Markdown 博客</GradientText>
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                用原创插画、可爱的图标点缀和玻璃拟态阅读容器，先把博客 2C
                端的长文体验打磨到能持续扩展的状态。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {heroFeatures.map((feature) => (
                <span
                  key={feature.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--glass-border) bg-white/45 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm dark:bg-white/5"
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

            <Button asChild size="lg" className="w-fit">
              <Link href="/posts/5f7448b7">
                查看示例文章
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="relative min-h-[22rem] overflow-hidden rounded-3xl border border-(--glass-border) bg-white/35 shadow-(--shadow-glass) dark:bg-white/5">
            <Image
              priority
              alt="原创博客阅读插画，包含 Markdown 文章面板、代码卡片和可爱的便签角色"
              src={siteAssets.blogHeroIllustration}
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 30rem, calc(100vw - 4rem)"
              className="size-full min-h-[22rem] object-cover"
            />

            <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
              {readingSignals.map((signal) => (
                <span
                  key={signal.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-(--glass-border) px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur-md ${signal.tone}`}
                >
                  <CuteIcon name={signal.icon} className="size-3.5 text-primary" />
                  {signal.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}

export { HomeHero };
