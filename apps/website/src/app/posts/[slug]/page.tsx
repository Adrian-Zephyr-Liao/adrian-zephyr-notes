import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, MarkdownRenderer, PostToc } from "@adrian-zephyr-notes/markdown";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  Copyright,
  FileText,
  FolderOpen,
  Hash,
  History,
  ShieldCheck,
  Tag,
} from "lucide-react";

import { ArticleSidebarProfile } from "@/components/markdown/article-sidebar-profile";
import { ArticleComments } from "@/components/markdown/article-comments";
import { ArticleMotionShell } from "@/components/markdown/article-motion-shell";
import { GlassPanel } from "@/components/primitives/glass-panel";
import { Badge } from "@/components/ui/badge";
import { getArticleBySlug } from "@/lib/articles-api";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getArticleBySlug(slug);

  if (!post) {
    return {};
  }

  return {
    title: `${post.title} | Adrian Zephyr Notes`,
    description: post.description,
  };
}

async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getArticleBySlug(slug);

  if (!post) {
    notFound();
  }

  const headings = getMarkdownHeadings(post.markdown);

  return (
    <main className="flex-1 overflow-x-clip px-3 pb-12 sm:px-4 sm:pb-14">
      <ArticleMotionShell>
        <div className="mx-auto grid w-full max-w-[1180px] gap-4 pt-5 sm:gap-5 sm:pt-8">
          <GlassPanel
            tone="strong"
            className="relative min-w-0 overflow-hidden rounded-2xl px-4 py-6 sm:rounded-3xl sm:px-8 lg:px-10 lg:py-12"
          >
            <div className="absolute inset-0 -z-10 bg-(image:--gradient-brand) opacity-10" />
            <div className="absolute -top-20 right-8 -z-10 size-64 rounded-full bg-primary/20 blur-3xl" />
            <Link
              className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-white/75 hover:text-foreground sm:mb-8 dark:bg-white/10 dark:hover:bg-white/15"
              href="/"
            >
              <ChevronLeft className="size-4" />
              返回首页
            </Link>
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <FolderOpen className="size-3" />
                  {post.category?.name ?? "未分类"}
                </Badge>
                {post.tags.map((tag) => (
                  <Badge
                    key={tag.slug}
                    variant="outline"
                    className="gap-1.5 bg-white/40 dark:bg-white/5"
                  >
                    <Tag className="size-3" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <div className="grid min-w-0 gap-4">
                <h1 className="flex max-w-full min-w-0 flex-wrap gap-x-2 gap-y-1 text-2xl/tight font-black tracking-normal wrap-anywhere text-foreground sm:max-w-4xl sm:gap-x-3 sm:text-5xl lg:text-6xl">
                  {post.title.split(" ").map((part) => (
                    <span key={part} className="max-w-full min-w-0 wrap-anywhere">
                      {part}
                    </span>
                  ))}
                </h1>
                <p className="max-w-3xl text-sm leading-7 wrap-anywhere text-muted-foreground sm:text-lg sm:leading-8">
                  {post.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 dark:bg-white/10">
                  <CalendarDays className="size-4 text-primary" />
                  发表于 {formatArticleDate(post.publishedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 dark:bg-white/10">
                  <History className="size-4 text-primary" />
                  更新于 {formatArticleDate(post.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 dark:bg-white/10">
                  <FileText className="size-4 text-primary" />
                  {post.wordCount.toLocaleString("zh-CN")} 字
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 dark:bg-white/10">
                  <Clock3 className="size-4 text-primary" />
                  {post.readingMinutes} 分钟
                </span>
              </div>
            </div>
          </GlassPanel>

          <div className="grid min-w-0 items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <GlassPanel
              tone="strong"
              className="min-w-0 rounded-2xl px-4 py-5 sm:rounded-3xl sm:px-8 sm:py-7 lg:px-10"
            >
              <MarkdownRenderer content={post.markdown} />
              <ArticleComments slug={post.slug} />

              <div className="mt-10 grid gap-4">
                <GlassPanel className="rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Copyright className="size-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-foreground">版权声明</div>
                        <p className="text-sm text-muted-foreground">
                          本文采用 CC BY-NC-SA 4.0 协议，转载请注明作者与链接。
                        </p>
                      </div>
                    </div>
                    <Badge className="w-fit gap-1.5" variant="secondary">
                      <ShieldCheck className="size-3" />
                      原创
                    </Badge>
                  </div>
                </GlassPanel>

                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Badge
                      key={tag.slug}
                      variant="outline"
                      className="gap-1.5 bg-white/45 dark:bg-white/5"
                    >
                      <Hash className="size-3" />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </GlassPanel>

            <aside className="hidden lg:grid lg:content-start lg:gap-4 lg:self-stretch">
              <ArticleSidebarProfile />
              <GlassPanel className="rounded-3xl p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                <PostToc headings={headings} />
              </GlassPanel>
            </aside>
          </div>
        </div>
      </ArticleMotionShell>
    </main>
  );
}

export default PostPage;

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}
