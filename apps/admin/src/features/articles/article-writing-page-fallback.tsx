import { Loader2 } from "lucide-react";

function ArticleWritingPageFallback() {
  return (
    <main
      className="grid h-dvh grid-rows-[auto_1fr] bg-background px-4 text-foreground sm:px-7 xl:px-12"
      role="status"
      aria-label="正在加载写作台"
      aria-busy="true"
    >
      <header className="mb-5 flex min-h-20 items-center justify-between gap-4 border-b border-border">
        <h1 className="font-display text-2xl font-semibold">
          AZ Notes <span className="font-normal text-primary">/ 校样间</span>
        </h1>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          <span className="hidden sm:inline">正在加载写作台</span>
        </span>
      </header>
      <section className="mb-5 grid min-h-0 gap-6 overflow-hidden lg:grid-cols-2">
        <div className="grid min-h-0 content-start gap-5 border border-border bg-card p-5 sm:p-7">
          <div className="h-16 animate-pulse rounded-sm bg-muted/60 motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-14 animate-pulse rounded-sm bg-muted/45 motion-reduce:animate-none" />
            <div className="h-14 animate-pulse rounded-sm bg-muted/45 motion-reduce:animate-none" />
          </div>
          <div className="h-12 animate-pulse rounded-sm bg-muted/40 motion-reduce:animate-none" />
          <div className="h-72 animate-pulse rounded-sm bg-muted/35 motion-reduce:animate-none" />
        </div>
        <div className="hidden min-w-0 space-y-5 px-10 py-8 lg:block">
          <div className="mb-10 h-4 w-20 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted/60 motion-reduce:animate-none" />
          {["w-full", "w-11/12", "w-3/4"].map((width) => (
            <div
              key={width}
              className={`h-4 animate-pulse rounded bg-muted/45 motion-reduce:animate-none ${width}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export { ArticleWritingPageFallback };
