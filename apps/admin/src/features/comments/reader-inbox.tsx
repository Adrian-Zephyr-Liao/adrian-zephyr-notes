import type { ReactNode } from "react";
import { ArrowUpRight, MessageCircle, NotebookPen } from "lucide-react";
import { cn } from "../../lib/utils";

type ReaderInboxProps = {
  children: ReactNode;
  detail: ReactNode;
  kind: "comments" | "guestbook";
  loading: boolean;
  pagination: ReactNode;
  toolbar: ReactNode;
  total?: number;
};

function ReaderInbox({
  children,
  detail,
  kind,
  loading,
  pagination,
  toolbar,
  total,
}: ReaderInboxProps) {
  return (
    <div className="grid min-w-0 border-t border-border lg:grid-cols-[9rem_minmax(18rem,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[10rem_minmax(21rem,0.85fr)_minmax(0,1.15fr)]">
      <nav
        aria-label="来信分区"
        className="flex flex-wrap content-start gap-1 border-b border-border py-4 lg:block lg:border-r lg:border-b-0 lg:py-6 lg:pr-5"
      >
        <p className="mb-5 hidden text-xs tracking-widest text-muted-foreground lg:block">
          读者来信
        </p>
        <a
          href="/comments"
          aria-current={kind === "comments" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 border-b border-transparent p-3 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring lg:px-0",
            kind === "comments" && "border-primary font-semibold text-primary",
          )}
        >
          <MessageCircle className="size-4" />
          文章评论
        </a>
        <a
          href="/guestbook"
          aria-current={kind === "guestbook" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 border-b border-transparent p-3 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring lg:px-0",
            kind === "guestbook" && "border-primary font-semibold text-primary",
          )}
        >
          <NotebookPen className="size-4" />
          留言板
        </a>
        <p className="mt-8 hidden border-t border-border pt-5 text-xs/6 text-muted-foreground lg:block">
          每一段交流，
          <br />
          都值得认真阅读。
        </p>
      </nav>
      <div className="min-w-0 border-b border-border lg:border-r lg:border-b-0">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 xl:px-6">
          <span className="text-sm font-medium">{kind === "comments" ? "文章评论" : "留言板"}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {!loading && total !== undefined ? `${total} 条` : "—"}
          </span>
        </div>
        <div className="border-b border-border p-3 xl:p-4">{toolbar}</div>
        <div
          role="group"
          aria-label="来信列表"
          className="max-h-[34rem] overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
        {pagination ? <div className="p-4 xl:px-6">{pagination}</div> : null}
      </div>
      <div className="min-w-0 px-1 py-6 sm:px-6 xl:px-9">{detail}</div>
    </div>
  );
}

function ReaderAvatar({
  name,
  src,
  large = false,
}: {
  name: string;
  src?: string | null;
  large?: boolean;
}) {
  const className = cn("shrink-0 rounded-sm bg-muted object-cover", large ? "size-16" : "size-11");
  return src ? (
    <img src={src} alt={name} className={className} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(className, "grid place-items-center font-display text-xl text-primary")}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ReaderInboxItem({
  active,
  author,
  avatar,
  body,
  context,
  date,
  index,
  onSelect,
}: {
  active: boolean;
  author: string;
  avatar?: string | null;
  body: string;
  context: string;
  date: string;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[1.25rem_2.75rem_minmax(0,1fr)] gap-3 border-b border-border border-l-2 border-l-transparent px-3 py-5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring xl:px-4",
        active && "border-l-primary bg-primary/5",
      )}
    >
      <span aria-hidden="true" className="pt-0.5 font-display text-lg text-primary">
        {String(index + 1).padStart(2, "0")}
      </span>
      <ReaderAvatar name={author} src={avatar} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{author}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{date}</span>
        </span>
        <span className="mt-1.5 line-clamp-2 block text-xs/6">{body.slice(0, 100)}…</span>
        <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">{context}</span>
      </span>
    </button>
  );
}

function ReaderRelatedLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="flex items-center justify-between gap-3 border-y border-border py-4 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
      href={href}
    >
      <span className="min-w-0 wrap-anywhere">{label}</span>
      <ArrowUpRight className="size-4 shrink-0" />
    </a>
  );
}

export { ReaderAvatar, ReaderInbox, ReaderInboxItem, ReaderRelatedLink };
