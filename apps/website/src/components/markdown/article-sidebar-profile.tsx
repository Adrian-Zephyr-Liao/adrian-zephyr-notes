import Image from "next/image";
import Link from "next/link";

import { ArticleNoticeCarousel } from "@/components/markdown/article-notice-carousel";
import { CuteIcon, type CuteIconName } from "@/components/primitives/cute-icon";
import { siteAssets } from "@/lib/site-assets";

type SocialLink = {
  href: string;
  icon: CuteIconName;
  label: string;
};

const socialLinks = [
  {
    href: "https://github.com",
    icon: "github-line",
    label: "GitHub",
  },
  {
    href: "https://www.bilibili.com",
    icon: "bilibili-line",
    label: "Bilibili",
  },
] satisfies readonly SocialLink[];

function ArticleSidebarProfile() {
  return (
    <div className="grid gap-4">
      <AuthorCard />
      <ArticleNoticeCarousel />
    </div>
  );
}

function AuthorCard() {
  return (
    <section
      data-slot="article-author-card"
      className="relative overflow-hidden rounded-3xl border border-(--glass-border) bg-(--glass-surface-strong) p-4 text-foreground shadow-(--shadow-glass-strong) backdrop-blur-xl dark:border-white/10 dark:bg-[oklch(0.22_0.032_252)] dark:text-white"
    >
      <Image
        loading="eager"
        aria-hidden="true"
        alt=""
        src={siteAssets.blogHeroIllustration}
        width={1536}
        height={1024}
        sizes="18rem"
        className="absolute inset-0 size-full object-cover opacity-10 mix-blend-luminosity dark:opacity-12"
      />
      <div className="absolute inset-0 bg-white/78 dark:bg-[oklch(0.22_0.032_252)]/86" />
      <div className="absolute -top-12 -left-12 size-32 rounded-full border-8 border-primary/10 dark:border-white/8" />
      <div className="absolute right-6 bottom-8 size-24 rounded-full border-8 border-primary/10 dark:border-white/8" />

      <div className="relative z-10 grid min-h-[20rem] content-between gap-6">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary shadow-sm ring-1 ring-primary/15 backdrop-blur-md dark:bg-white/18 dark:text-white dark:ring-white/10">
            <CuteIcon name="sleep-line" className="size-3.5" />
            睡个好觉，保持好奇心
          </span>
        </div>

        <div className="grid justify-items-center gap-4">
          <div className="relative">
            <div className="relative size-28 overflow-hidden rounded-full border-[6px] border-white bg-white shadow-xl ring-1 ring-foreground/10 dark:ring-white/15">
              <Image
                loading="eager"
                alt="Adrian 的原创笔记本头像"
                src={siteAssets.authorAvatar}
                width={1254}
                height={1254}
                sizes="7rem"
                className="size-full object-cover"
              />
            </div>
            <span className="absolute right-0 bottom-1 flex size-10 items-center justify-center rounded-full border-4 border-white bg-secondary text-secondary-foreground shadow-lg dark:bg-[oklch(0.92_0.08_78)] dark:text-[oklch(0.48_0.11_78)]">
              <CuteIcon name="magic-2-line" className="size-5" />
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <h2 className="text-2xl/tight font-black tracking-normal">Adrian</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-white/62">
              Adrian&apos;s notes
            </p>
          </div>

          <div className="flex gap-3">
            {socialLinks.map((link) => (
              <SocialIconLink key={link.label} {...link} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialIconLink({ href, icon, label }: SocialLink) {
  return (
    <Link
      aria-label={label}
      href={href}
      className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/16 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:bg-white/18 dark:text-white dark:hover:bg-white/26 dark:focus-visible:ring-white/45"
    >
      <CuteIcon name={icon} className="size-5" />
    </Link>
  );
}

export { ArticleSidebarProfile };
