"use client";

import Image from "next/image";
import { BookOpenText } from "lucide-react";
import { useState } from "react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { cn } from "@/lib/utils";
import { getArticleCoverSource } from "./article-cover-source";

function ArticleCover({
  article,
  sizes = "(max-width: 680px) 100vw, (max-width: 900px) 50vw, 33vw",
  preload = false,
  className,
}: {
  article: ArticleListItemResponse;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [failedOptimization, setFailedOptimization] = useState<string | null>(null);
  const source = getArticleCoverSource(article.coverImageUrl);
  const unoptimized = source
    ? failedOptimization === source ||
      (source.startsWith("http") && !source.startsWith("https://img.zephyrai.site/"))
    : false;

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-muted", className)}>
      {source && failedSource !== source ? (
        <Image
          src={source}
          alt={`${article.title} · 文章封面`}
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover transition-transform duration-650 ease-(--ease-out-ui) motion-reduce:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/article:scale-[1.045]"
          unoptimized={unoptimized}
          onError={() => {
            if (unoptimized) setFailedSource(source);
            else setFailedOptimization(source);
          }}
        />
      ) : (
        <div className="grid size-full content-center justify-items-center gap-3 bg-[radial-gradient(ellipse_at_20%_20%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_70%)] text-sm text-primary">
          <BookOpenText aria-hidden="true" size={36} strokeWidth={1.25} />
          <span>{article.category?.name ?? "一页笔记"}</span>
        </div>
      )}
    </div>
  );
}

export { ArticleCover };
