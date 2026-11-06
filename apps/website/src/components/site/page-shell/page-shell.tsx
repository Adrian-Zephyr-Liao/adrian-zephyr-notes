import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

function PageShell({ className, ...props }: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-(--site-width) flex-1 px-5 pt-10 pb-16 min-[681px]:px-8 min-[681px]:pt-16 min-[681px]:pb-24",
        className,
      )}
      {...props}
    />
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 grid gap-3 border-b border-border pb-6 min-[681px]:mb-12 min-[681px]:gap-4 min-[681px]:pb-8",
        className,
      )}
    >
      <p
        className="font-display text-[clamp(2.75rem,6vw,5.5rem)] leading-[1.05] tracking-[-0.05em] text-primary italic"
        lang="en"
      >
        {eyebrow}
      </p>
      <h1 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.4] font-bold text-pretty wrap-anywhere">
        {title}
      </h1>
      {description ? (
        <p className="max-w-176 text-sm leading-[1.9] text-muted-foreground min-[681px]:text-base">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}

function PageBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground outline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <ArrowLeft aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}

function PageEmptyState({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-4 px-4 py-16 text-center text-muted-foreground">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {description ? <p className="max-w-lg text-sm leading-7">{description}</p> : null}
      {children}
    </div>
  );
}

export { PageBackLink, PageEmptyState, PageHeader, PageShell };
