"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Feather, Search } from "lucide-react";

import { navigation } from "./data";
import { MobileNavigation } from "./mobile-navigation";
import { navigationLinkClassName } from "./styles";
import { ThemeToggle } from "./theme-toggle";

function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-3 z-50 mx-auto mt-3 w-[calc(100%-2rem)] max-w-(--site-width) min-[851px]:top-6 min-[851px]:mt-6 min-[851px]:w-[calc(100%-4rem)]">
      <nav
        aria-label="主导航"
        className="relative flex min-h-15 items-center gap-2 rounded-full border border-foreground/42 bg-background/95 py-[0.4rem] pr-3 pl-4 backdrop-blur-lg min-[851px]:min-h-16 min-[851px]:gap-4 min-[851px]:px-5 min-[851px]:py-2 min-[1101px]:gap-8 min-[1101px]:px-7"
      >
        <Link
          href="/"
          aria-label="Adrian Zephyr Notes · 返回首页"
          className="inline-flex min-w-0 items-center gap-2 font-display text-[clamp(0.9rem,2.8vw,1.3rem)] font-semibold whitespace-nowrap italic outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary min-[851px]:gap-[0.85rem] min-[851px]:border-r min-[851px]:border-border min-[851px]:pr-5 min-[851px]:text-xl min-[1101px]:pr-8 min-[1101px]:text-[1.45rem]"
        >
          <Feather
            aria-hidden="true"
            size={29}
            strokeWidth={1.6}
            className="w-[22px] shrink-0 text-primary min-[851px]:w-[29px]"
          />
          <span className="max-[391px]:max-w-38 max-[391px]:truncate">Adrian Zephyr Notes</span>
        </Link>
        <div className="ml-auto hidden items-center gap-[1.4rem] min-[851px]:flex min-[1101px]:gap-[2.4rem]">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navigationLinkClassName}
              aria-current={
                pathname.startsWith(item.href) ||
                (item.href === "/archives" && pathname.startsWith("/posts/"))
                  ? "page"
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center min-[851px]:ml-0 min-[851px]:gap-[0.4rem]">
          <Link
            href="/archives#archive-search"
            aria-label="搜索文章"
            className="inline-flex min-h-11 w-10 items-center justify-center rounded-full text-muted-foreground outline-offset-4 hover:bg-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-primary max-[391px]:hidden min-[851px]:w-11"
          >
            <Search size={19} aria-hidden="true" />
          </Link>
          <ThemeToggle />
          <MobileNavigation pathname={pathname} />
        </div>
      </nav>
    </header>
  );
}

export { SiteHeader };
