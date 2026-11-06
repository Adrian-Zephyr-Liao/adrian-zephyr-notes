import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { StatusIllustration } from "@/components/site/status-page";
import { cn } from "@/lib/utils";
import { RecentArticles } from "./recent-articles";
import { RandomReading } from "./random-reading";
import { homeActionClassName, homeTextLinkClassName } from "./styles";

function ArticleListSection({ articles }: { articles: ArticleListItemResponse[] }) {
  return (
    <section id="articles" className="scroll-mt-32 pb-20" aria-labelledby="recent-title">
      <div className="flex items-end justify-between gap-6 max-[680px]:items-start">
        <div>
          <p className="text-[0.95rem] font-semibold tracking-[0.06em] text-primary uppercase max-[680px]:text-xs">
            The notebook
          </p>
          <h2
            id="recent-title"
            className="mt-[0.6rem] flex items-baseline gap-4 text-[clamp(2.1rem,3.5vw,3rem)] font-bold tracking-[-0.04em] max-[680px]:gap-2 max-[680px]:text-[2rem]"
          >
            最近写下的
            <span
              className="font-display text-[2rem] font-normal text-primary italic max-[680px]:text-2xl"
              aria-hidden="true"
            >
              〰
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-8 max-[1000px]:gap-4 max-[680px]:flex-col max-[680px]:items-end max-[680px]:gap-[0.3rem]">
          <Link
            className={cn(homeActionClassName, homeTextLinkClassName, "max-[680px]:text-[0.72rem]")}
            href="/archives"
          >
            全部文章 <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          {articles.length > 0 ? (
            <RandomReading slugs={articles.map((article) => article.slug)} />
          ) : null}
        </div>
      </div>
      {articles.length > 0 ? (
        <RecentArticles articles={articles} />
      ) : (
        <div className="grid justify-items-center gap-4 px-4 py-12 text-center text-muted-foreground">
          <StatusIllustration className="max-w-48" variant="empty-articles" />
          <h3>笔记本的下一页，正在准备中。</h3>
          <p>新文章发布后会出现在这里。</p>
        </div>
      )}
    </section>
  );
}

export { ArticleListSection };
