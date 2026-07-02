import Link from "next/link";

import { desktopDropdownGroups } from "./data";
import { NavDropdown } from "./nav-dropdown";

function DesktopNav() {
  return (
    <div className="ml-auto hidden items-center gap-0.5 xl:flex">
      <Link
        className="flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-foreground/78 transition duration-200 hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10"
        href="/archives"
      >
        文章
      </Link>
      {desktopDropdownGroups.map((group) => (
        <NavDropdown key={group.label} group={group} />
      ))}
    </div>
  );
}

export { DesktopNav };
