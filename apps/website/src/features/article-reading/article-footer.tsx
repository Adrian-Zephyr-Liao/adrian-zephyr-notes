import Link from "next/link";
import type { ArticleDetailResponse } from "@adrian-zephyr-notes/contracts";
import { Copyright, Hash } from "lucide-react";

function ArticleFooter({ post }: { post: ArticleDetailResponse }) {
  const isReposted = post.origin === "REPOSTED";
  return (
    <>
      <section
        className="mt-14 flex items-start gap-4 border-t border-border py-6 text-[0.85rem] leading-[1.9] text-muted-foreground"
        aria-label={isReposted ? "转载说明" : "版权声明"}
      >
        <Copyright size={20} aria-hidden="true" className="mt-1 shrink-0 text-primary" />
        <div>
          <h2 className="mb-1 text-[0.95rem] font-semibold text-foreground">
            {isReposted ? "转载说明" : "版权声明"}
          </h2>
          <p>
            {isReposted
              ? "本文版权归原作者及原发布方所有，转载信息以上方来源为准。"
              : "本文采用 CC BY-NC-SA 4.0 协议，转载请注明作者与链接。"}
          </p>
        </div>
      </section>
      <nav
        className="flex flex-wrap gap-x-5 gap-y-2 pb-6 text-[0.8rem] text-primary [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center [&_a]:gap-[0.3rem] [&_a:hover]:underline [&_a:hover]:underline-offset-4"
        aria-label="文章标签"
      >
        {post.tags.map((tag) => (
          <Link key={tag.slug} href={`/tags/${tag.slug}`}>
            <Hash size={13} aria-hidden="true" />
            {tag.name}
          </Link>
        ))}
      </nav>
    </>
  );
}

export { ArticleFooter };
