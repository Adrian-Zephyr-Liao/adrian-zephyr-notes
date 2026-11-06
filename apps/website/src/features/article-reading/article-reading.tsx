import Link from "next/link";
import type {
  ArticleDetailResponse,
  SiteAnnouncementResponse,
} from "@adrian-zephyr-notes/contracts";
import { getMarkdownHeadings } from "@adrian-zephyr-notes/markdown";
import { ArrowLeft } from "lucide-react";
import { ArticleCover } from "@/entities/article";
import { ArticleHeader } from "./article-header";
import { ArticleBody } from "./article-body";
import { ArticleSidebarProfile } from "./article-sidebar-profile";
import { ArticleToc } from "./article-toc";

function ArticleReading({
  post,
  announcements,
}: {
  post: ArticleDetailResponse;
  announcements: SiteAnnouncementResponse[];
}) {
  const headings = getMarkdownHeadings(post.markdown);
  return (
    <main className="min-w-0 flex-1 px-5 pt-8 pb-12 min-[601px]:px-8 min-[601px]:pt-14 min-[601px]:pb-20 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-5 [&_a]:focus-visible:outline-primary [&_summary]:focus-visible:outline-2 [&_summary]:focus-visible:outline-offset-5 [&_summary]:focus-visible:outline-primary">
      <div className="mx-auto max-w-[1320px]">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-[0.9rem] text-muted-foreground hover:text-primary"
          href="/archives"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          回到文章归档
        </Link>
        <ArticleHeader post={post} />
        <div className="max-w-[1120px] overflow-hidden rounded-[0.65rem] min-[601px]:rounded-2xl">
          <ArticleCover article={post} sizes="(max-width: 1160px) 100vw, 1120px" preload />
        </div>
        <div className="grid grid-cols-[minmax(0,760px)] items-start justify-center gap-8 pt-8 min-[601px]:pt-14 min-[901px]:grid-cols-[minmax(0,760px)_minmax(0,220px)] min-[901px]:justify-start min-[901px]:gap-10 min-[1101px]:grid-cols-[minmax(0,760px)_minmax(0,264px)] min-[1101px]:gap-20">
          <ArticleBody post={post} headings={headings} />
          <aside
            className="hidden min-w-0 content-start gap-10 self-stretch min-[901px]:grid"
            aria-label="作者与阅读导航"
          >
            <ArticleSidebarProfile announcements={announcements} />
            <ArticleToc headings={headings} />
          </aside>
        </div>
      </div>
    </main>
  );
}

export { ArticleReading };
