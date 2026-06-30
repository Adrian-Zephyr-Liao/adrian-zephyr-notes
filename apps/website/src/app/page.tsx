import Link from "next/link";
import { ArrowRight, BookOpenText, Sparkles } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { GradientText } from "@/components/primitives/gradient-text";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex-1 overflow-hidden px-3 pb-14 sm:px-4">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] w-[min(1180px,calc(100vw-1.5rem))] items-center py-10 sm:w-[min(1180px,calc(100vw-2rem))]">
        <GlassPanel
          tone="strong"
          className="relative overflow-hidden rounded-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14"
        >
          <div className="absolute inset-0 -z-10 bg-(image:--gradient-brand) opacity-10" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="grid gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/55 px-3 py-1.5 text-sm font-semibold text-muted-foreground dark:bg-white/10">
                <Sparkles className="size-4 text-primary" />
                Markdown reading system
              </div>
              <div className="grid gap-4">
                <h1 className="max-w-4xl text-4xl/tight font-black tracking-normal text-balance wrap-anywhere sm:text-6xl">
                  一版接近主题站体验的 <GradientText>Markdown 渲染</GradientText>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  使用 React Markdown、GFM、标题锚点、Shiki 代码高亮和玻璃拟态文章容器，先打磨博客
                  2C 端长文阅读的基础体验。
                </p>
              </div>
              <Button asChild size="lg" className="w-fit">
                <Link href="/posts/5f7448b7">
                  查看示例文章
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <GlassPanel className="grid gap-3 rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpenText className="size-4 text-primary" />
                <span>当前覆盖</span>
              </div>
              <ul className="grid gap-2 text-sm text-muted-foreground">
                <li>GFM 表格、任务列表、脚注、删除线</li>
                <li>标题锚点与右侧文章目录</li>
                <li>Shiki 代码高亮和代码标题</li>
                <li>版权、标签、文章元信息卡片</li>
              </ul>
            </GlassPanel>
          </div>
        </GlassPanel>
      </section>
    </main>
  );
}
