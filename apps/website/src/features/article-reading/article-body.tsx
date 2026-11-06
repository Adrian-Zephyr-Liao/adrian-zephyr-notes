import type { ArticleDetailResponse } from "@adrian-zephyr-notes/contracts";
import { MarkdownRenderer, type MarkdownHeading } from "@adrian-zephyr-notes/markdown";
import { ExternalLink } from "lucide-react";
import { ArticleComments } from "@/features/article-comments";
import { ArticleAiSummaryCard } from "./article-ai-summary-card";
import { ArticleFooter } from "./article-footer";
import { ArticleToc } from "./article-toc";

function ArticleBody({
  post,
  headings,
}: {
  post: ArticleDetailResponse;
  headings: MarkdownHeading[];
}) {
  return (
    <div className="min-w-0">
      <ArticleToc headings={headings} mobile />
      {post.origin === "REPOSTED" && post.source ? (
        <aside className="mb-10 grid gap-2 border-l-2 border-primary pl-5 text-[0.9rem] leading-[1.8] text-muted-foreground">
          <p>
            本文转载自 {post.source.name}
            {post.source.author ? ` · 原作者 ${post.source.author}` : ""}
          </p>
          <a
            className="inline-flex w-fit items-center gap-[0.4rem] text-primary hover:underline hover:underline-offset-4"
            href={post.source.url}
            rel="nofollow noreferrer"
            target="_blank"
          >
            查看原文
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </aside>
      ) : null}
      {post.aiSummary ? <ArticleAiSummaryCard summary={post.aiSummary} /> : null}
      <div className="[&_.markdown-body]:text-base [&_.markdown-body]:leading-[1.95] [&_.markdown-body]:text-foreground min-[601px]:[&_.markdown-body]:text-[1.0625rem] min-[601px]:[&_.markdown-body]:leading-loose [&_.markdown-body_h2]:border-border [&_.markdown-body_h2]:pb-3 [&_.markdown-body_h2::before]:hidden">
        <MarkdownRenderer content={post.markdown} />
      </div>
      <ArticleFooter post={post} />
      <ArticleComments slug={post.slug} />
    </div>
  );
}

export { ArticleBody };
