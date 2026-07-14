import Link from "next/link";

import { cn } from "@/lib/utils";

import type { NavChild } from "./types";

function HeaderLink({ item, compact = false }: { item: NavChild; compact?: boolean }) {
  const Icon = item.icon;
  const className = cn(
    "flex items-center gap-2 rounded-lg text-sm font-medium text-foreground/75 transition-colors duration-150 ease-(--ease-out-ui) hover:bg-white/55 hover:text-foreground motion-reduce:transition-none dark:hover:bg-white/10 [&_svg]:pointer-events-none",
    compact ? "px-3 py-2" : "px-3.5 py-2.5",
  );

  if (item.external) {
    return (
      <a className={className} href={item.href} target="_blank" rel="noreferrer">
        <Icon className="size-4" />
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <Link className={className} href={item.href}>
      <Icon className="size-4" />
      <span>{item.label}</span>
    </Link>
  );
}

export { HeaderLink };
