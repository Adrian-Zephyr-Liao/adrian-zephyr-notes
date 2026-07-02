import Link from "next/link";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

import { portalLinks } from "./data";
import { SiteHeaderDisclosure } from "./site-header-disclosure";
import { glassMenuSurfaceClassName } from "./styles";
import type { PortalLink } from "./types";

function PortalCard({ item }: { item: PortalLink }) {
  const Icon = item.icon;

  return (
    <Link
      className="group/card grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-xl p-2.5 transition duration-200 hover:bg-white/60 dark:hover:bg-white/10 [&_svg]:pointer-events-none"
      href={item.href}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm transition duration-200 group-hover/card:scale-105",
          item.tone,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
      </span>
    </Link>
  );
}

function PortalMenu() {
  return (
    <SiteHeaderDisclosure className="group/portal relative" name="site-header-disclosure">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl border border-white/35 bg-white/45 text-foreground/70 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 [&_svg]:pointer-events-none [&::-webkit-details-marker]:hidden"
        aria-label="打开站点入口"
      >
        <GripVertical className="size-4" />
      </summary>
      <div className="pointer-events-none invisible absolute top-12 left-0 w-72 translate-y-1 opacity-0 transition duration-200 group-open/portal:pointer-events-auto group-open/portal:visible group-open/portal:translate-y-0 group-open/portal:opacity-100">
        <div className={cn(glassMenuSurfaceClassName, "shadow-(--shadow-glass-strong)")}>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">网页</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold text-primary">
              入口
            </span>
          </div>
          <div className="grid gap-1">
            {portalLinks.map((item) => (
              <PortalCard key={item.href} item={item} />
            ))}
          </div>
        </div>
      </div>
    </SiteHeaderDisclosure>
  );
}

export { PortalMenu };
