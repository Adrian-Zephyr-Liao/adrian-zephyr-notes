"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { ArticleCover } from "@/entities/article";
import { cn } from "@/lib/utils";

const cardPositions = [
  "relative top-0 z-3 -rotate-3 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-2 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:-rotate-1",
  "absolute top-6 z-1 -translate-x-[31%] translate-y-2 -rotate-12 scale-[0.86] opacity-90",
  "absolute top-6 z-2 translate-x-[31%] translate-y-2 rotate-11 scale-[0.86] opacity-95",
] as const;

const turnButtonClassName =
  "grid h-11 w-12 cursor-pointer place-items-center rounded-full border border-foreground/65 transition-[background-color,transform] duration-200 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary active:scale-[0.94] motion-reduce:transition-none";

function FeaturedReading({ articles }: { articles: ArticleListItemResponse[] }) {
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);
  const count = articles.length;

  function turn(direction: number) {
    setActive((current) => (current + direction + count) % count);
  }

  function handleArrowKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      turn(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  return (
    <section
      className="min-w-0 touch-pan-y"
      aria-label="翻阅新近文章"
      aria-roledescription="轮播"
      onPointerDown={(event) => {
        startX.current = event.pointerType === "touch" ? event.clientX : null;
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
      onPointerUp={(event) => {
        if (startX.current !== null && Math.abs(event.clientX - startX.current) > 45)
          turn(event.clientX < startX.current ? 1 : -1);
        startX.current = null;
      }}
    >
      <div className="relative mx-auto w-full max-w-188 pt-6 pb-12 perspective-[1200px] max-[850px]:max-w-140 max-[680px]:max-w-116 max-[680px]:pb-8">
        {articles.map((article, index) => {
          const position = (index - active + count) % count;
          return (
            <article
              key={article.id}
              className={cn(
                "left-[18%] aspect-[4/5.15] w-[64%] overflow-hidden rounded-3xl border border-foreground/55 bg-card shadow-[0_1.5rem_3rem_#0002] transition-[translate,rotate,scale,opacity] duration-600 ease-(--ease-out-ui) motion-reduce:transition-none max-[680px]:left-[17%] max-[680px]:aspect-[4/5.2] max-[680px]:w-[66%] max-[680px]:rounded-[1.1rem]",
                cardPositions[position],
              )}
              data-position={position}
              aria-hidden={position !== 0}
              inert={position !== 0}
            >
              <Link
                className="relative flex h-full items-end -outline-offset-5 focus-visible:outline-3 focus-visible:outline-primary"
                href={`/posts/${article.slug}`}
                tabIndex={position === 0 ? 0 : -1}
              >
                <div className="absolute inset-0">
                  <ArticleCover
                    article={article}
                    className="aspect-auto h-full"
                    sizes="(max-width: 680px) 85vw, 500px"
                    preload={index === 0}
                  />
                </div>
                <div className="relative z-1 grid w-full gap-[0.85rem] bg-[linear-gradient(0deg,#111e25ed_5%,#15212bcc_52%,transparent)] px-7 pt-24 pb-7 text-[#fff3dc] max-[850px]:px-5 max-[680px]:gap-[0.6rem] max-[680px]:px-4 max-[680px]:pt-18 max-[680px]:pb-[1.15rem]">
                  <p className="text-[0.9rem] text-[#a1e4d1] before:mr-2 before:inline-block before:h-[0.8rem] before:w-[0.2rem] before:rounded-[1px] before:bg-[#a1e4d1] before:content-[''] max-[680px]:text-[0.72rem]">
                    {index === 0 ? "最新一篇" : (article.category?.name ?? "翻到这篇")}
                  </p>
                  <h2 className="line-clamp-3 text-[clamp(1.25rem,1.85vw,1.65rem)] leading-[1.5] font-bold wrap-anywhere max-[850px]:text-[1.2rem] max-[680px]:text-base">
                    {article.title}
                  </h2>
                  <div className="flex items-center justify-between text-[0.9rem] text-[#f1e5cf] max-[680px]:text-[0.72rem]">
                    <span>{article.readingMinutes} 分钟阅读</span>
                    <ArrowUpRight size={19} aria-hidden="true" />
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
      {count > 1 ? (
        <div className="mt-[0.4rem] flex items-center justify-center gap-8 max-[680px]:gap-6">
          <button
            type="button"
            className={turnButtonClassName}
            onClick={() => turn(-1)}
            onKeyDown={handleArrowKey}
            aria-label="上一篇封面"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <p className="font-mono text-[0.95rem] text-foreground">
            <span className="mr-[0.4rem] text-primary">{String(active + 1).padStart(2, "0")}</span>{" "}
            / {String(count).padStart(2, "0")}
          </p>
          <button
            type="button"
            className={turnButtonClassName}
            onClick={() => turn(1)}
            onKeyDown={handleArrowKey}
            aria-label="下一篇封面"
          >
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        第 {active + 1} 篇，共 {count} 篇：{articles[active]?.title}
      </p>
    </section>
  );
}

export { FeaturedReading };
