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
  const listRef = useRef<HTMLOListElement>(null);
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

    const nextActiveHeadingId = getActiveTocHeadingId(headingPositions, tocReadingAnchorTop);
    setActiveHeadingId(nextActiveHeadingId);

    const list = listRef.current;
    const link = nextActiveHeadingId ? linkRefs.current.get(nextActiveHeadingId) : undefined;

    if (!list || !link || list.clientHeight === 0) {
      return;
    }

    // Only move the list; scrollIntoView would also move the page and its other ancestors.
    const listTop = list.getBoundingClientRect().top;
    const linkRect = link.getBoundingClientRect();
    const top = linkRect.top - listTop;
    const bottom = linkRect.bottom - listTop;

    if (top < 0) {
      list.scrollTop += top;
    } else if (bottom > list.clientHeight) {
      list.scrollTop += Math.min(top, bottom - list.clientHeight);
    }
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

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="文章目录" className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
        <ListTree className="size-4 text-primary" />
        <span>文章目录</span>
      </div>
      <ol
        ref={listRef}
        className="grid min-h-0 min-w-0 gap-1 overflow-x-hidden overflow-y-auto overscroll-contain py-1 text-sm"
      >
        {items.map((heading) => (
          <li key={heading.id} className="min-w-0">
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
                "flex min-h-11 min-w-0 items-start gap-2 border-l-2 border-transparent p-2 text-muted-foreground transition-colors outline-offset-2 hover:bg-primary/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none aria-[current=location]:border-primary aria-[current=location]:bg-primary/5 aria-[current=location]:font-semibold aria-[current=location]:text-primary",
                heading.depth === 3 && "pl-6 text-xs",
              )}
              href={`#${heading.id}`}
              onClick={() => setActiveHeadingId(heading.id)}
            >
              <span className="min-w-5 shrink-0 pt-0.5 text-xs text-primary tabular-nums">
                {heading.order}
              </span>
              <span className="min-w-0 wrap-anywhere">{heading.text}</span>
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
