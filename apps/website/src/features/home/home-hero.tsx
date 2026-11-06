import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { siteAssets } from "@/lib/site-assets";
import { cn } from "@/lib/utils";
import { FeaturedReading } from "./featured-reading";
import { homeActionClassName, homeTextLinkClassName } from "./styles";

function HomeHero({ articles }: { articles: ArticleListItemResponse[] }) {
  return (
    <>
      <section
        className="grid min-h-168 grid-cols-[minmax(0,0.87fr)_minmax(0,1.13fr)] items-center gap-10 pt-14 pb-10 max-[1000px]:min-h-140 max-[1000px]:gap-6 max-[680px]:min-h-0 max-[680px]:grid-cols-1 max-[680px]:gap-8 max-[680px]:pb-4"
        aria-labelledby="home-title"
      >
        <div>
          <h1
            id="home-title"
            className="mb-7 text-[clamp(2.5rem,4.2vw,3.65rem)] leading-[1.4] font-bold tracking-[-0.04em] max-[1000px]:text-[2.7rem] max-[680px]:mb-4 max-[680px]:text-[clamp(1.9rem,7vw,2.7rem)]"
          >
            把想法写下来，
            <br />
            让灵感有迹可循。
          </h1>
          <p className="max-w-136 text-[clamp(0.95rem,1.35vw,1.15rem)] leading-[1.9] text-pretty text-foreground max-[680px]:max-w-96 max-[680px]:text-sm">
            关于技术、创造，以及把事情做好的过程。
          </p>
          <div className="mt-11 flex flex-wrap items-center gap-8 max-[680px]:mt-6 max-[680px]:gap-6">
            <a
              className={cn(
                homeActionClassName,
                "rounded-full bg-primary px-[1.8rem] py-[0.9rem] text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_12%)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-px max-[680px]:px-5 max-[680px]:py-3",
              )}
              href="#articles"
            >
              开始阅读 <ArrowDown size={18} aria-hidden="true" />
            </a>
            <Link className={cn(homeActionClassName, homeTextLinkClassName)} href="/archives">
              逛逛归档 <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        {articles.length > 0 ? (
          <FeaturedReading articles={articles.slice(0, 3)} />
        ) : (
          <Image
            src={siteAssets.blogHeroIllustration}
            alt="一张等待新想法的书桌"
            width={640}
            height={480}
            className="w-full rounded-2xl"
          />
        )}
      </section>
      <p className="mt-8 mb-20 flex items-center gap-6 text-center text-[0.95rem] tracking-[0.08em] text-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-[''] max-[680px]:mt-7 max-[680px]:mb-14 max-[680px]:gap-3 max-[680px]:text-[0.7rem] max-[680px]:tracking-normal">
        写代码，也记录沿途的发现。
      </p>
    </>
  );
}

export { HomeHero };
