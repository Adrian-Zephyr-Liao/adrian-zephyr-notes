import { DesktopNav } from "./desktop-nav";
import { HeaderActions } from "./header-actions";
import { MobileMenu } from "./mobile-menu";
import { PortalMenu } from "./portal-menu";
import { SiteBrand } from "./site-brand";

function SiteHeader() {
  return (
    <header className="sticky top-3 z-50 mx-auto w-[min(1180px,calc(100%-1rem))]">
      <nav
        className="relative flex min-h-14 items-center gap-2 rounded-2xl border border-(--glass-border) bg-(--glass-surface) px-2.5 shadow-(--shadow-glass) backdrop-blur-xl md:px-3"
        aria-label="主导航"
      >
        <div className="flex min-w-0 items-center gap-2">
          <PortalMenu />
          <SiteBrand />
        </div>

        <DesktopNav />
        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          <HeaderActions />
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}

export { SiteHeader };
