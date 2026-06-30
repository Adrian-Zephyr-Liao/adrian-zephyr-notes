import { ListTree } from "lucide-react";

import type { MarkdownHeading } from "./heading";
import { cx } from "./utils";

function PostToc({ headings }: { headings: MarkdownHeading[] }) {
  let sectionIndex = 0;
  const items = headings.map((heading) => ({
    ...heading,
    order: heading.depth === 2 ? `${++sectionIndex}.` : "·",
  }));

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
              className={cx(
                "group/toc flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-white/55 hover:text-foreground dark:hover:bg-white/10",
                heading.depth === 3 && "pl-6 text-xs",
              )}
              href={`#${heading.id}`}
            >
              <span className="min-w-5 text-xs text-primary/75 tabular-nums">{heading.order}</span>
              <span className="truncate">{heading.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { PostToc };
