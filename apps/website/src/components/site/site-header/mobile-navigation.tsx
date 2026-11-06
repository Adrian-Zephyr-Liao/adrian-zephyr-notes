import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";

import { navigation } from "./data";
import { SiteHeaderDisclosure } from "./site-header-disclosure";
import { mobileLinkClassName } from "./styles";

function MobileNavigation({ pathname }: { pathname: string }) {
  return (
    <SiteHeaderDisclosure className="block min-[851px]:hidden">
      <summary
        aria-label="打开导航菜单"
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <Menu size={22} aria-hidden="true" />
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="absolute top-[calc(100%+0.75rem)] right-0 grid min-w-56 gap-[0.2rem] rounded-2xl border border-border bg-popover p-3 shadow-[0_1rem_3rem_#0002]">
        <Link href="/" className={mobileLinkClassName}>
          首页
        </Link>
        <Link href="/archives#archive-search" className={mobileLinkClassName}>
          搜索文章
        </Link>
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={mobileLinkClassName}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <a href="/rss.xml" target="_blank" rel="noreferrer" className={mobileLinkClassName}>
          RSS 订阅
        </a>
      </div>
    </SiteHeaderDisclosure>
  );
}

export { MobileNavigation };
