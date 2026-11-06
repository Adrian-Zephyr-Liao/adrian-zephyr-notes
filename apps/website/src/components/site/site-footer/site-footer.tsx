import Link from "next/link";
import { ArrowUpRight, Feather, Rss } from "lucide-react";

const footerLinkClassName =
  "inline-flex min-h-11 items-center gap-[0.4rem] outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary";

function SiteFooter() {
  return (
    <footer
      id="notebook-footer"
      className="mx-auto mt-auto w-[calc(100%-2.5rem)] max-w-[calc(var(--site-width)-4rem)] border-t border-border pt-10 pb-20 min-[681px]:w-[calc(100%-4rem)] min-[681px]:pb-12"
    >
      <div className="mb-10 flex items-center justify-center gap-3 text-[0.9rem] text-muted-foreground">
        <Feather size={24} strokeWidth={1.5} aria-hidden="true" className="text-primary" />
        <p>写代码，也记录沿途的发现。</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 min-[681px]:justify-between">
        <Link
          href="/"
          className="font-display text-[1.15rem] italic outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          Adrian Zephyr Notes
        </Link>
        <nav
          aria-label="页脚导航"
          className="flex flex-wrap items-center gap-4 text-[0.8rem] text-muted-foreground min-[681px]:gap-6"
        >
          <Link href="/archives" className={footerLinkClassName}>
            所有文章
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <Link href="/comments" className={footerLinkClassName}>
            留一张纸条
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <a href="/rss.xml" target="_blank" rel="noreferrer" className={footerLinkClassName}>
            <Rss size={14} aria-hidden="true" />
            RSS
          </a>
        </nav>
      </div>
    </footer>
  );
}

export { SiteFooter };
