import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

function ManagementSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg bg-(--glass-surface) shadow-(--shadow-glass) backdrop-blur-2xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

function ManagementHeader({
  action,
  description,
  meta,
  title,
}: {
  action?: ReactNode;
  description: string;
  meta?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          {meta}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ManagementBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-4 px-3 pb-3 sm:px-5 sm:pb-5", className)}>{children}</div>;
}

function ManagementToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2 rounded-lg bg-background/24 p-2.5", className)}>{children}</div>
  );
}

function ManagementList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "divide-y divide-border/45 overflow-hidden rounded-lg bg-background/18",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ManagementLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-20 items-center justify-center gap-2 px-4 py-5 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function ManagementEmpty({ label }: { label: string }) {
  return (
    <div className="min-h-28 px-5 py-10 text-center text-sm text-muted-foreground">{label}</div>
  );
}

function ManagementPagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const normalizedTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {normalizedTotalPages} 页
      </span>
      <div className="flex gap-2">
        <Button
          aria-label="上一页"
          disabled={page <= 1}
          size="icon"
          title="上一页"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label="下一页"
          disabled={page >= normalizedTotalPages}
          size="icon"
          title="下一页"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export {
  ManagementBody,
  ManagementEmpty,
  ManagementHeader,
  ManagementList,
  ManagementLoading,
  ManagementPagination,
  ManagementSurface,
  ManagementToolbar,
};
