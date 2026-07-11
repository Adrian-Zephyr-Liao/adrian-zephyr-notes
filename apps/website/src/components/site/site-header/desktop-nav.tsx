import { desktopDropdownGroups } from "./data";
import { NavDropdown } from "./nav-dropdown";

function DesktopNav() {
  return (
    <div className="ml-auto hidden items-center gap-0.5 xl:flex">
      {desktopDropdownGroups.map((group) => (
        <NavDropdown key={group.label} group={group} />
      ))}
    </div>
  );
}

export { DesktopNav };
