import type {
  ArticleCategoryDetailResponse,
  ArticleListResponse,
} from "@adrian-zephyr-notes/contracts";

import { PageHeader, PageShell } from "@/components/site/page-shell";
import { ArchivePagination } from "./archive-pagination";
import { ArchiveResults } from "./archive-results";
import { ArchiveToolbar } from "./archive-toolbar";
import type { ArchiveQuery } from "./archive-query";

function ArticleArchive({
  articles,
  categories,
  query,
}: {
  articles: ArticleListResponse;
  categories: ArticleCategoryDetailResponse[];
  query: ArchiveQuery;
}) {
  const hasFilters = Boolean(query.q || query.category || query.tag);
  return (
    <PageShell className="pt-14 max-[600px]:pt-10 min-[681px]:pt-14">
      <PageHeader
        eyebrow={
          <span className="block text-[clamp(4.25rem,8vw,8rem)] leading-none font-medium tracking-[-0.065em] text-foreground max-[600px]:text-[clamp(3.25rem,13vw,4.5rem)]">
            Archives
          </span>
        }
        title={
          <span className="block text-[clamp(2.6rem,5vw,4.5rem)] leading-[1.12] font-black tracking-[-0.035em] max-[600px]:text-[2.35rem]">
            文章归档
          </span>
        }
        description={
          <span className="block border-l-[3px] border-primary pl-[0.9rem] text-[clamp(0.95rem,1.5vw,1.2rem)] leading-[1.7] max-[600px]:text-[0.8rem]">
            每一篇，都是思考留下的坐标。
          </span>
        }
        className="relative mb-0 gap-3 border-b-0 pr-52 pb-10 max-[600px]:pr-24 max-[600px]:pb-7 min-[681px]:mb-0 min-[681px]:gap-3 min-[681px]:pb-10"
      >
        <div className="absolute right-0 bottom-10 grid justify-items-end gap-1 pb-[0.45rem] text-[0.9rem] whitespace-nowrap max-[600px]:top-2 max-[600px]:bottom-auto max-[600px]:gap-2 max-[600px]:text-[0.65rem]">
          <span className="font-display text-[clamp(5rem,12vw,11rem)] leading-[0.8] tracking-[-0.085em] text-[color-mix(in_oklch,var(--primary)_32%,var(--background))] italic tabular-nums max-[600px]:text-[4rem]">
            {String(articles.pagination.totalItems).padStart(2, "0")}
          </span>
          <span>{hasFilters ? "篇匹配的公开文章" : "篇公开文章"}</span>
        </div>
      </PageHeader>
      <ArchiveToolbar categories={categories} query={query} />
      <ArchiveResults articles={articles.data} query={query} />
      <ArchivePagination pagination={articles.pagination} query={query} />
    </PageShell>
  );
}

export { ArticleArchive };
