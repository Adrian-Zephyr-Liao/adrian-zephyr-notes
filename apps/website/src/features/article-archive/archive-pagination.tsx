import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ArticleListResponse } from "@adrian-zephyr-notes/contracts";

import { cn } from "@/lib/utils";
import { archiveHref, type ArchiveQuery } from "./archive-query";
import { archiveActionClassName } from "./styles";

function ArchivePagination({
  pagination,
  query,
}: {
  pagination: ArticleListResponse["pagination"];
  query: ArchiveQuery;
}) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1 && page <= 1) return null;
  const linkClassName = cn(
    archiveActionClassName,
    "border border-border px-[0.9rem] py-2 max-[600px]:px-[0.6rem] max-[600px]:text-[0.8rem] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary",
  );
  const disabledClassName =
    "inline-flex min-h-[2.85rem] items-center justify-center gap-[0.45rem] rounded-[0.6rem] border border-border px-[0.9rem] py-2 text-[0.9rem] font-semibold whitespace-nowrap opacity-40 max-[600px]:px-[0.6rem] max-[600px]:text-[0.8rem]";
  return (
    <nav
      className="mt-12 flex flex-wrap items-center justify-center gap-[0.7rem] border-t border-border pt-6"
      aria-label="归档文章分页"
    >
      {page > 1 ? (
        <Link href={archiveHref(query, { page: page - 1 })} className={linkClassName}>
          <ArrowLeft aria-hidden="true" size={16} />
          上一页
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          <ArrowLeft aria-hidden="true" size={16} />
          上一页
        </span>
      )}
      <span
        className="px-[0.6rem] text-[0.85rem] text-muted-foreground tabular-nums max-[600px]:px-0 max-[600px]:text-xs"
        aria-live="polite"
      >
        第 {page} / {Math.max(totalPages, 1)} 页
      </span>
      {page < totalPages ? (
        <Link href={archiveHref(query, { page: page + 1 })} className={linkClassName}>
          下一页
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          下一页
          <ArrowRight aria-hidden="true" size={16} />
        </span>
      )}
    </nav>
  );
}

export { ArchivePagination };
