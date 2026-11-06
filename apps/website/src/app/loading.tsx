import { PageShell } from "@/components/site/page-shell";

export default function Loading() {
  return (
    <PageShell aria-busy="true" aria-label="页面加载中">
      <p className="mb-8 font-display text-[clamp(2.75rem,6vw,5.5rem)] leading-[1.05] tracking-[-0.05em] text-primary italic">
        Turning the page…
      </p>
      <div
        className="grid gap-8 motion-safe:animate-pulse sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {[0, 1, 2].map((item) => (
          <div className="grid gap-4" key={item}>
            <div className="aspect-video rounded-xl bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-6 w-5/6 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
      <output className="sr-only">正在翻开下一页，请稍候。</output>
    </PageShell>
  );
}
