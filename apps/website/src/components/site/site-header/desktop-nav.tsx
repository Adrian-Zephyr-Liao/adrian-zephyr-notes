import Link from "next/link";

import { primaryNavGroups, secondaryNavGroups } from "./data";
import { NavDropdown } from "./nav-dropdown";

function DesktopNav() {
  return (
    <div className="ml-auto hidden items-center gap-0.5 xl:flex">
      {primaryNavGroups.map((group) => (
        <NavDropdown key={group.label} group={group} />
      ))}
      <Link
        className="mx-1 block max-w-48 shrink-0 truncate rounded-full bg-white/50 px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm transition hover:bg-white/75 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15"
        href="/archives"
      >
        归档
      </Link>
      {secondaryNavGroups.map((group) => (
        <NavDropdown key={group.label} group={group} />
      ))}
    </div>
  );
}

export { DesktopNav };
