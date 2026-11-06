import Link from "next/link";
import type { ArticleDetailResponse } from "@adrian-zephyr-notes/contracts";
import { CalendarDays, Clock3, FileText, History } from "lucide-react";

function ArticleHeader({ post }: { post: ArticleDetailResponse }) {
  return (
    <header className="max-w-[1040px] pt-5 pb-8 min-[601px]:pt-10 min-[601px]:pb-11">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[0.9rem] text-primary">
        {post.category ? (
          <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
        ) : (
          <span>未分类</span>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-muted-foreground">
          {post.origin === "REPOSTED" ? "转载笔记" : "原创笔记"}
        </span>
      </div>
      <h1 className="mt-5 mb-6 max-w-[1040px] text-[1.9rem] leading-normal font-bold tracking-[-0.035em] text-pretty wrap-anywhere min-[601px]:text-[clamp(2rem,4.6vw,4.15rem)] min-[601px]:leading-[1.38]">
        {post.title}
      </h1>
      <p className="max-w-[800px] text-[0.95rem] leading-[1.95] wrap-anywhere text-muted-foreground min-[601px]:text-[1.075rem]">
        {post.description}
      </p>
      <ArticleMeta post={post} />
    </header>
  );
}

function ArticleMeta({ post }: { post: ArticleDetailResponse }) {
  return (
    <div className="mt-7 flex flex-wrap gap-x-4 gap-y-[0.6rem] text-[0.7rem] leading-[1.7] text-muted-foreground min-[601px]:gap-x-5 min-[601px]:text-[0.8rem] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.45rem]">
      <span>
        <CalendarDays size={14} aria-hidden="true" />
        发表于 <time dateTime={post.publishedAt}>{formatArticleDate(post.publishedAt)}</time>
      </span>
      <span>
        <History size={14} aria-hidden="true" />
        更新于 <time dateTime={post.updatedAt}>{formatArticleDate(post.updatedAt)}</time>
      </span>
      <span>
        <FileText size={14} aria-hidden="true" />
        {post.wordCount.toLocaleString("zh-CN")} 字
      </span>
      <span>
        <Clock3 size={14} aria-hidden="true" />
        {post.readingMinutes} 分钟阅读
      </span>
    </div>
  );
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export { ArticleHeader };
