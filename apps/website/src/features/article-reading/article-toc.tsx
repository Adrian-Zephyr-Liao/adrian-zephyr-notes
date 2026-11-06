import { PostToc, type MarkdownHeading } from "@adrian-zephyr-notes/markdown";
import { cn } from "@/lib/utils";

const tocClassName =
  "[&_.markdown-toc-link]:rounded-none [&_.markdown-toc-link]:pr-2 [&_.markdown-toc-link-active]:text-primary [&_.markdown-toc-link-active]:[text-shadow:none] [&_.markdown-toc-link::before]:hidden [&_.markdown-toc-link::after]:hidden [&_.markdown-toc-link-guide]:hidden";

function ArticleToc({
  headings,
  mobile = false,
}: {
  headings: MarkdownHeading[];
  mobile?: boolean;
}) {
  if (!headings.length) return null;
  if (mobile) {
    return (
      <details
        className={cn(
          "mb-8 border-y border-border py-4 min-[901px]:hidden [&[open]>summary]:mb-4",
          tocClassName,
        )}
      >
        <summary className="cursor-pointer text-[0.9rem] text-primary">浏览文章目录</summary>
        <PostToc headings={headings} />
      </details>
    );
  }
  return (
    <div
      className={cn(
        "sticky top-30 flex max-h-[calc(100dvh-9rem)] min-h-0 flex-col border-t border-border pt-6",
        tocClassName,
      )}
    >
      <PostToc headings={headings} />
    </div>
  );
}

export { ArticleToc };
