import Image from "next/image";
import type { SiteAnnouncementResponse } from "@adrian-zephyr-notes/contracts";
import { ArticleNoticeCarousel } from "./article-notice-carousel";
import { siteAssets } from "@/lib/site-assets";

function ArticleSidebarProfile({ announcements }: { announcements: SiteAnnouncementResponse[] }) {
  return (
    <div className="grid gap-8">
      <section data-slot="article-author-card" className="grid gap-4 border-t border-border pt-5">
        <div className="flex items-center gap-3">
          <Image
            alt="Adrian 的笔记本头像"
            src={siteAssets.authorAvatar}
            width={64}
            height={64}
            sizes="64px"
            className="size-16 rounded-full object-cover"
          />
          <div>
            <h2 className="font-display text-xl italic">Adrian</h2>
            <p className="mt-1 text-xs text-muted-foreground">写代码，也记录生活。</p>
          </div>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">
          睡个好觉，保持好奇心。欢迎在评论里分享你的想法。
        </p>
      </section>
      <ArticleNoticeCarousel announcements={announcements} />
    </div>
  );
}
export { ArticleSidebarProfile };
