"use client";

import { ListTree } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MarkdownHeading } from "./heading";
import { getActiveTocHeadingId, type TocHeadingPosition } from "./post-toc-active";
import { cx } from "./utils";

const tocReadingAnchorTop = 112;

function PostToc({ headings }: { headings: MarkdownHeading[] }) {
  const items = useMemo(() => createPostTocItems(headings), [headings]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(() => items[0]?.id ?? null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());

  const updateActiveHeading = useCallback(() => {
    const headingPositions = items
      .map<TocHeadingPosition | null>((heading) => {
        const element = document.getElementById(heading.id);

        if (!element) {
          return null;
        }

        return {
          id: heading.id,
          top: element.getBoundingClientRect().top,
        };
      })
      .filter((heading): heading is TocHeadingPosition => Boolean(heading));

    setActiveHeadingId(getActiveTocHeadingId(headingPositions, tocReadingAnchorTop));
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    let animationFrameId = 0;
    const requestUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("hashchange", requestUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("hashchange", requestUpdate);
    };
  }, [items.length, updateActiveHeading]);

  useEffect(() => {
    if (!activeHeadingId) {
      return;
    }

    linkRefs.current.get(activeHeadingId)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeHeadingId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="文章目录" className="grid gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListTree className="size-4 text-primary" />
        <span>文章目录</span>
      </div>
      <ol className="grid gap-1 text-sm">
        {items.map((heading) => (
          <li key={heading.id}>
            <a
              ref={(element) => {
                if (element) {
                  linkRefs.current.set(heading.id, element);
                  return;
                }

                linkRefs.current.delete(heading.id);
              }}
              aria-current={activeHeadingId === heading.id ? "location" : undefined}
              className={cx(
                "markdown-toc-link group/toc flex items-center gap-2 rounded-lg py-1.5 pr-10 pl-2 text-muted-foreground transition hover:bg-white/55 hover:text-foreground dark:hover:bg-white/10",
                heading.depth === 3 && "pl-6 text-xs",
                activeHeadingId === heading.id && "markdown-toc-link-active text-foreground",
              )}
              href={`#${heading.id}`}
              onClick={() => setActiveHeadingId(heading.id)}
            >
              <span
                className={cx(
                  "min-w-5 text-xs tabular-nums text-primary/75 transition",
                  activeHeadingId === heading.id && "text-primary",
                )}
              >
                {heading.order}
              </span>
              <span className="markdown-toc-link-text truncate">{heading.text}</span>
              <span aria-hidden="true" className="markdown-toc-link-guide" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function createPostTocItems(headings: MarkdownHeading[]) {
  let sectionIndex = 0;

  return headings.map((heading) => ({
    ...heading,
    order: heading.depth === 2 ? `${++sectionIndex}.` : "·",
  }));
}

export { PostToc };
