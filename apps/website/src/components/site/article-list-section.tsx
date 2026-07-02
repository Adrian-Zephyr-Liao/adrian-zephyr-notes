import Link from "next/link";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import { ArrowRight, CalendarDays, Clock3, FileText, FolderOpen, Tag } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { StatusIllustration } from "@/components/status/status-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function ArticleListSection({ articles }: { articles: ArticleListItemResponse[] }) {
  return (
    <section
      id="articles"
      className="mx-auto grid w-[min(1180px,calc(100vw-1.5rem))] scroll-mt-24 gap-5 py-10 sm:w-[min(1180px,calc(100vw-2rem))]"
    >
      <div className="grid gap-2">
        <h2 className="text-2xl/tight font-black tracking-normal text-foreground sm:text-3xl">
          最新文章
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          最近整理的技术笔记、工程实践和写作归档。
        </p>
      </div>

      {articles.length === 0 ? (
        <GlassPanel className="grid justify-items-center gap-4 rounded-3xl p-6 text-center">
          <StatusIllustration className="max-w-[13rem]" variant="empty-articles" />
          <div className="grid gap-1">
            <h3 className="text-base font-black text-foreground">还没有已发布文章</h3>
            <p className="text-sm text-muted-foreground">发布后的文章会自动出现在这里。</p>
          </div>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}

function ArticleCard({ article }: { article: ArticleListItemResponse }) {
  return (
    <GlassPanel
      tone="strong"
      className="grid min-h-72 content-between gap-6 rounded-3xl p-5 sm:p-6"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <FolderOpen className="size-3" />
            {article.category?.name ?? "未分类"}
          </Badge>
          {article.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.slug} variant="outline" className="gap-1.5 bg-white/40 dark:bg-white/5">
              <Tag className="size-3" />
              {tag.name}
            </Badge>
          ))}
        </div>

        <div className="grid gap-3">
          <h3 className="text-2xl/tight font-black tracking-normal wrap-anywhere text-foreground">
            {article.title}
          </h3>
          <p className="line-clamp-3 text-sm leading-7 wrap-anywhere text-muted-foreground">
            {article.description}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-primary" />
            {formatArticleDate(article.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" />
            {article.wordCount.toLocaleString("zh-CN")} 字
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5 text-primary" />
            {article.readingMinutes} 分钟
          </span>
        </div>

        <Button asChild className="w-fit">
          <Link href={`/posts/${article.slug}`}>
            阅读文章
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </GlassPanel>
  );
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export { ArticleListSection };
