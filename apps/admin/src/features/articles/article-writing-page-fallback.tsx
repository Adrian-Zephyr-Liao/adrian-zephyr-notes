import { Loader2, PenLine } from "lucide-react";

function ArticleWritingPageFallback() {
  return (
    <main className="grid h-dvh grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/70 bg-(--glass-surface-strong) px-4 shadow-sm backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-foreground text-background shadow-(--shadow-glass)">
            <PenLine className="size-4" />
          </span>
          <div className="grid gap-1">
            <div className="h-4 w-28 rounded-full bg-muted/75 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-44 rounded-full bg-muted/55 motion-safe:animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="h-9 w-24 rounded-xl border border-border/70 bg-background/70 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-9 w-20 rounded-xl bg-primary/70 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
      </header>

      <section className="grid min-h-0 gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <div className="h-16 rounded-2xl border border-border/70 bg-card/75 shadow-sm motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="h-16 rounded-2xl border border-border/70 bg-card/75 shadow-sm motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="h-16 rounded-2xl border border-border/70 bg-card/75 shadow-sm motion-safe:animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-(--shadow-glass)">
            <div className="mb-4 h-4 w-32 rounded-full bg-muted/70 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="grid gap-3">
              <div className="h-4 w-3/4 rounded-full bg-muted/55 motion-safe:animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-5/6 rounded-full bg-muted/55 motion-safe:animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-2/3 rounded-full bg-muted/55 motion-safe:animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/65 p-8 shadow-(--shadow-glass)">
          <div className="grid gap-4">
            <div className="h-8 w-40 rounded-full bg-muted/70 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="h-4 w-64 rounded-full bg-muted/55 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="mt-6 grid gap-3">
              <div className="h-4 w-full rounded-full bg-muted/45 motion-safe:animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-11/12 rounded-full bg-muted/45 motion-safe:animate-pulse motion-reduce:animate-none" />
              <div className="h-4 w-3/4 rounded-full bg-muted/45 motion-safe:animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
          <div className="absolute right-5 bottom-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            正在加载写作台
          </div>
        </div>
      </section>
    </main>
  );
}

export { ArticleWritingPageFallback };
