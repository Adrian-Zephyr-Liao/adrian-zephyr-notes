import { PostToc, type MarkdownHeading } from "@adrian-zephyr-notes/markdown";

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
      <details className="mb-8 border-y border-border py-4 min-[901px]:hidden [&[open]>summary]:mb-4">
        <summary className="min-h-11 cursor-pointer py-2.5 text-[0.9rem] text-primary">
          浏览文章目录
        </summary>
        <PostToc headings={headings} />
      </details>
    );
  }
  return (
    <div className="sticky top-30 flex max-h-[calc(100dvh-9rem)] min-h-0 flex-col border-t border-border pt-6">
      <PostToc headings={headings} />
    </div>
  );
}

export { ArticleToc };
