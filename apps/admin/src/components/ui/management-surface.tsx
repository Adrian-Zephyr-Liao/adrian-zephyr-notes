import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

function ManagementSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      data-slot="management-surface"
      className={cn("min-w-0 border-t border-border bg-transparent", className)}
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
  className,
}: {
  action?: ReactNode;
  description: string;
  meta?: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {title ? (
            <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          ) : null}
          {meta}
        </div>
        <p className="mt-1.5 max-w-2xl text-sm/6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ManagementBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-5 py-5", className)}>{children}</div>;
}

function ManagementToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 border-b border-border pb-5", className)}>{children}</div>;
}

function ManagementList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border", className)}>{children}</div>;
}

function ManagementLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center gap-2.5 px-4 py-8 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      {label}
    </div>
  );
}

function ManagementEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-y border-border px-5 py-10 text-center">
      <span className="grid size-10 place-items-center text-primary">
        <Inbox aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </span>
      <p className="max-w-sm text-sm/6 text-muted-foreground">{label}</p>
    </div>
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
    <div className="flex items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
      <span className="tabular-nums">
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
