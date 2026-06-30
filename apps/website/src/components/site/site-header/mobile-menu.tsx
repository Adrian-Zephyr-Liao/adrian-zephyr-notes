import { ChevronDown, LayoutGrid, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { navGroups } from "./data";
import { HeaderLink } from "./header-link";
import { glassMenuSurfaceClassName } from "./styles";

function MobileMenu() {
  return (
    <details className="group/mobile relative xl:hidden" name="site-header-disclosure">
      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl bg-white/45 text-foreground/75 transition hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/15 [&_svg]:pointer-events-none [&::-webkit-details-marker]:hidden">
        <Menu className="size-4 group-open/mobile:hidden" />
        <X className="hidden size-4 group-open/mobile:block" />
        <span className="sr-only">打开移动端菜单</span>
      </summary>
      <div
        className={cn(
          "absolute top-12 right-0 w-[min(21rem,calc(100vw-1.5rem))] shadow-(--shadow-glass-strong)",
          glassMenuSurfaceClassName,
        )}
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/45 px-3 py-2 dark:bg-white/10">
          <LayoutGrid className="size-4 text-primary" />
          <span className="text-sm font-semibold">导航菜单</span>
        </div>
        <div className="grid gap-2">
          {navGroups.map((group) => (
            <details
              key={group.label}
              className="group/mobile-section rounded-xl bg-white/35 dark:bg-white/5"
              name="mobile-nav-section"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold [&_svg]:pointer-events-none [&::-webkit-details-marker]:hidden">
                <span>{group.label}</span>
                <ChevronDown className="size-4 transition group-open/mobile-section:rotate-180" />
              </summary>
              <div className="grid gap-1 px-1.5 pb-1.5">
                {group.items.map((item) => (
                  <HeaderLink key={item.href} compact item={item} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

export { MobileMenu };
