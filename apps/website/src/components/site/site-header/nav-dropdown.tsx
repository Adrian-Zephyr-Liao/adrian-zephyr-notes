import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { HeaderLink } from "./header-link";
import { SiteHeaderDisclosure } from "./site-header-disclosure";
import { glassMenuSurfaceClassName } from "./styles";
import type { NavGroup } from "./types";

function NavDropdown({ group }: { group: NavGroup }) {
  return (
    <SiteHeaderDisclosure className="group/navitem relative" name="site-header-disclosure">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-foreground/78 transition-colors duration-150 ease-(--ease-out-ui) hover:bg-white/50 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none dark:hover:bg-white/10 [&_svg]:pointer-events-none [&::-webkit-details-marker]:hidden">
        <span>{group.label}</span>
        <ChevronDown className="size-3.5 transition-transform duration-150 ease-(--ease-out-ui) group-open/navitem:rotate-180 motion-reduce:transition-none motion-reduce:group-open/navitem:rotate-0" />
      </summary>
      <div className="pointer-events-none invisible absolute top-12 left-1/2 w-44 -translate-x-1/2 translate-y-1 opacity-0 transition-[opacity,translate,visibility] duration-150 ease-(--ease-out-ui) group-open/navitem:pointer-events-auto group-open/navitem:visible group-open/navitem:translate-y-0 group-open/navitem:opacity-100 motion-reduce:transition-none motion-reduce:group-open/navitem:translate-y-0">
        <div className={cn(glassMenuSurfaceClassName, "grid gap-1 shadow-(--shadow-glass)")}>
          {group.items.map((item) => (
            <HeaderLink key={item.href} compact item={item} />
          ))}
        </div>
      </div>
    </SiteHeaderDisclosure>
  );
}

export { NavDropdown };
