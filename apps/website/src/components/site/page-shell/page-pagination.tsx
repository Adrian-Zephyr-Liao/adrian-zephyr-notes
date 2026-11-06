import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

const pageLinkClassName =
  "inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] border border-border px-4 py-2 text-foreground transition-colors outline-offset-4 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none";

function PagePagination({
  page,
  totalPages,
  basePath,
  label,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  label: string;
}) {
  if (totalPages <= 1) return null;

  function href(next: number) {
    return next === 1 ? basePath : `${basePath}?page=${next}`;
  }

  return (
    <nav
      className="mt-12 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-7 text-sm text-muted-foreground"
      aria-label={label}
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={pageLinkClassName}>
          <ArrowLeft aria-hidden="true" size={16} />
          上一页
        </Link>
      ) : (
        <span aria-disabled="true">上一页</span>
      )}
      <span>
        第 {page} / {totalPages} 页
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={pageLinkClassName}>
          下一页
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <span aria-disabled="true">下一页</span>
      )}
    </nav>
  );
}

export { PagePagination };
