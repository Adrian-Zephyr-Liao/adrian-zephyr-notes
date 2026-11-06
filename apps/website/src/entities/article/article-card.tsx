import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cva } from "class-variance-authority";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { cn } from "@/lib/utils";
import { ArticleCover } from "./article-cover";

type ArticleCardLayout = "cover" | "compact" | "timeline" | "feature" | "lead" | "archive";

const articleLinkVariants = cva(
  "group/article grid h-full content-start gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-primary",
  {
    variants: {
      layout: {
        cover: "",
        lead: "",
        archive: "",
        compact:
          "grid-cols-[minmax(0,1fr)_minmax(8.5rem,42%)] items-center gap-5 rounded-none border-b border-border pb-6",
        timeline:
          "grid-cols-[10rem_minmax(0,1fr)] items-center gap-6 rounded-none border-b border-border pb-6 max-[680px]:grid-cols-[5.5rem_minmax(0,1fr)] max-[680px]:gap-4",
        feature:
          "grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-10 max-[680px]:grid-cols-1 max-[680px]:gap-4",
      },
    },
    defaultVariants: { layout: "cover" },
  },
);

function ArticleCard({
  article,
  layout = "cover",
  heading: Heading = "h3",
}: {
  article: ArticleListItemResponse;
  layout?: ArticleCardLayout;
  heading?: "h2" | "h3";
}) {
  return (
    <article className="min-w-0" data-layout={layout}>
      <Link className={articleLinkVariants({ layout })} href={`/posts/${article.slug}`}>
        <div
          className={cn(
            "relative min-w-0 overflow-hidden rounded-xl border border-foreground/8 bg-muted",
            layout === "compact" && "col-start-2 row-start-1",
          )}
        >
          <ArticleCover
            article={article}
            className={cn(
              layout === "compact" && "aspect-4/3",
              layout === "timeline" && "max-[680px]:aspect-square",
            )}
          />
          <span
            className="absolute right-3 bottom-3 grid size-9 translate-y-2 place-items-center rounded-full bg-background text-foreground opacity-0 transition-[opacity,translate] duration-200 group-focus-visible/article:translate-y-0 group-focus-visible/article:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/article:translate-y-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/article:opacity-100"
            aria-hidden="true"
          >
            <ArrowUpRight size={20} />
          </span>
        </div>
        <div
          className={cn(
            "grid min-w-0 content-start gap-[0.55rem]",
            layout === "compact" && "col-start-1 row-start-1",
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-[0.3rem] text-[0.85rem] leading-[1.6] text-muted-foreground max-[680px]:text-xs",
              layout === "timeline" && "max-[680px]:text-[0.65rem]",
            )}
          >
            <span className="text-primary">{article.category?.name ?? "未分类"}</span>
            <span aria-hidden="true">·</span>
            <span>{article.readingMinutes} 分钟阅读</span>
            {article.origin === "REPOSTED" ? <span>转载</span> : null}
          </div>
          <Heading
            className={cn(
              "text-[1.4rem] leading-[1.65] font-bold text-pretty wrap-anywhere transition-colors duration-200 group-hover/article:text-primary group-focus-visible/article:text-primary motion-reduce:transition-none max-[680px]:text-[1.2rem]",
              layout === "compact" && "line-clamp-3 text-xl max-[680px]:text-[1.05rem]",
              layout === "lead" && "text-[1.75rem] max-[680px]:text-[1.4rem]",
              layout === "archive" && "text-xl max-[680px]:text-xl",
              layout === "timeline" && "text-[1.1rem] max-[680px]:text-[0.95rem]",
              layout === "feature" && "max-w-lg text-[1.6rem]",
            )}
          >
            {article.title}
          </Heading>
          {layout !== "compact" && layout !== "archive" ? (
            <p
              className={cn(
                "line-clamp-2 text-[0.95rem] leading-[1.9] wrap-anywhere text-muted-foreground",
                layout === "timeline" && "line-clamp-1 max-[680px]:hidden",
                layout === "feature" && "max-w-136 line-clamp-3",
              )}
            >
              {article.description}
            </p>
          ) : null}
          <time
            className="font-mono text-xs text-muted-foreground tabular-nums"
            dateTime={article.publishedAt}
          >
            {new Intl.DateTimeFormat("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              timeZone: "Asia/Shanghai",
            }).format(new Date(article.publishedAt))}
          </time>
        </div>
      </Link>
    </article>
  );
}

export { ArticleCard };
