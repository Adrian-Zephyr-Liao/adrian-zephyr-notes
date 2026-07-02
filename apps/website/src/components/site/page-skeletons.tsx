import { GlassPanel } from "@/components/primitives/glass-panel";
import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-full bg-foreground/10 dark:bg-white/10", className)}
    />
  );
}

function SkeletonPill({ className }: { className?: string }) {
  return <SkeletonBlock className={cn("h-8 w-24", className)} />;
}

function HomePageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="页面加载中"
      className="flex-1 overflow-hidden px-3 pb-14 sm:px-4"
    >
      <section className="mx-auto grid w-[min(1180px,calc(100vw-1.5rem))] gap-6 pt-8 sm:w-[min(1180px,calc(100vw-2rem))] sm:pt-12">
        <GlassPanel tone="strong" className="grid gap-8 rounded-3xl px-5 py-8 sm:px-8 lg:px-10">
          <div className="grid max-w-3xl gap-5">
            <SkeletonPill className="w-36" />
            <div className="grid gap-3">
              <SkeletonBlock className="h-11 w-full max-w-3xl sm:h-14" />
              <SkeletonBlock className="h-11 w-4/5 max-w-2xl sm:h-14" />
            </div>
            <div className="grid max-w-2xl gap-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-5/6" />
              <SkeletonBlock className="h-4 w-2/3" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SkeletonPill className="h-10 w-32" />
              <SkeletonPill className="h-10 w-28" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["hero-stat-1", "hero-stat-2", "hero-stat-3"].map((key) => (
              <div
                key={key}
                className="grid gap-3 rounded-2xl border border-(--glass-border) bg-white/35 p-4 dark:bg-white/5"
              >
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-8 w-24" />
              </div>
            ))}
          </div>
        </GlassPanel>
      </section>

      <section className="mx-auto grid w-[min(1180px,calc(100vw-1.5rem))] gap-5 py-10 sm:w-[min(1180px,calc(100vw-2rem))]">
        <div className="grid gap-2">
          <SkeletonBlock className="h-8 w-32" />
          <SkeletonBlock className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {["article-card-1", "article-card-2"].map((key) => (
            <GlassPanel
              key={key}
              tone="strong"
              className="grid min-h-72 gap-6 rounded-3xl p-5 sm:p-6"
            >
              <div className="flex flex-wrap gap-2">
                <SkeletonPill className="h-7 w-24" />
                <SkeletonPill className="h-7 w-20" />
              </div>
              <div className="grid gap-3">
                <SkeletonBlock className="h-8 w-4/5" />
                <SkeletonBlock className="h-8 w-3/5" />
                <div className="grid gap-2 pt-1">
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-11/12" />
                  <SkeletonBlock className="h-4 w-2/3" />
                </div>
              </div>
              <div className="mt-auto grid gap-4">
                <div className="flex flex-wrap gap-2">
                  <SkeletonPill className="h-5 w-24" />
                  <SkeletonPill className="h-5 w-20" />
                </div>
                <SkeletonPill className="h-10 w-28" />
              </div>
            </GlassPanel>
          ))}
        </div>
      </section>
    </main>
  );
}

function ArticlePageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="文章加载中"
      className="flex-1 overflow-x-clip px-3 pb-12 sm:px-4 sm:pb-14"
    >
      <div className="mx-auto grid w-full max-w-[1180px] gap-4 pt-5 sm:gap-5 sm:pt-8">
        <GlassPanel
          tone="strong"
          className="grid gap-6 rounded-2xl px-4 py-6 sm:rounded-3xl sm:px-8 lg:px-10 lg:py-12"
        >
          <SkeletonPill className="h-8 w-28" />
          <div className="flex flex-wrap gap-2">
            <SkeletonPill className="h-7 w-24" />
            <SkeletonPill className="h-7 w-20" />
            <SkeletonPill className="h-7 w-20" />
          </div>
          <div className="grid max-w-4xl gap-3">
            <SkeletonBlock className="h-10 w-full sm:h-14" />
            <SkeletonBlock className="h-10 w-4/5 sm:h-14" />
          </div>
          <div className="grid max-w-3xl gap-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-10/12" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SkeletonPill className="w-32" />
            <SkeletonPill className="w-32" />
            <SkeletonPill className="w-24" />
            <SkeletonPill className="w-24" />
          </div>
        </GlassPanel>

        <div className="grid min-w-0 items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <GlassPanel
            tone="strong"
            className="grid gap-7 rounded-2xl px-4 py-5 sm:rounded-3xl sm:px-8 sm:py-7 lg:px-10"
          >
            <div className="grid gap-3">
              <SkeletonBlock className="h-7 w-48" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-11/12" />
              <SkeletonBlock className="h-4 w-5/6" />
            </div>
            <div className="grid gap-3">
              <SkeletonBlock className="h-6 w-36" />
              {["line-1", "line-2", "line-3", "line-4", "line-5"].map((key, index) => (
                <SkeletonBlock key={key} className={cn("h-4", index === 4 ? "w-7/12" : "w-full")} />
              ))}
            </div>
            <div className="grid gap-3 rounded-2xl border border-(--glass-border) bg-white/30 p-4 dark:bg-white/5">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
            </div>
            <div className="grid gap-3">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-24 w-full rounded-2xl" />
            </div>
          </GlassPanel>

          <aside className="hidden lg:grid lg:content-start lg:gap-4">
            <GlassPanel className="grid gap-4 rounded-3xl p-5">
              <SkeletonBlock className="size-16 rounded-2xl" />
              <SkeletonBlock className="h-6 w-40" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
            </GlassPanel>
            <GlassPanel className="grid gap-3 rounded-3xl p-4">
              <SkeletonBlock className="h-5 w-24" />
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-4 w-36" />
            </GlassPanel>
          </aside>
        </div>
      </div>
    </main>
  );
}

export { ArticlePageSkeleton, HomePageSkeleton };
