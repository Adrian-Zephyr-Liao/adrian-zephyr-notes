import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";

function ArticleTaxonomyPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        aria-label="上一页"
        disabled={page <= 1}
        size="icon"
        variant="outline"
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-20 text-center text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        aria-label="下一页"
        disabled={page >= totalPages}
        size="icon"
        variant="outline"
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export { ArticleTaxonomyPagination };
