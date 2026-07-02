"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SiteAnnouncementResponse } from "@adrian-zephyr-notes/contracts";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { CuteIcon, type CuteIconName } from "@/components/primitives/cute-icon";
import { cn } from "@/lib/utils";

type NoticeSlide = {
  icon: CuteIconName;
  iconClassName: string;
  process: string;
  status: string;
  command: string;
  output: string;
  title: string;
};

type ArticleNoticeCarouselProps = {
  announcements: SiteAnnouncementResponse[];
};

const fallbackNoticeSlide = {
  command: "load site-config",
  icon: "terminal-box-line",
  iconClassName: "text-primary",
  output: "公告配置暂时为空。",
  process: "notice.config",
  status: "empty",
  title: "notice config",
} satisfies NoticeSlide;

const rotationDelay = 5200;
const noticeStatusColor = "color-mix(in oklab, var(--primary) 70%, transparent)";
const noticeStatusBackground = "color-mix(in oklab, var(--primary) 12%, transparent)";
const noticeStatusStyle = {
  "--notice-status-color": noticeStatusColor,
} as CSSProperties;

const activeNoticeDotStyle = {
  backgroundColor: noticeStatusColor,
} as CSSProperties;

const noticeStatusTextStyle = {
  color: noticeStatusColor,
} as CSSProperties;

const noticeStatusBadgeStyle = {
  backgroundColor: noticeStatusBackground,
  color: noticeStatusColor,
} as CSSProperties;

function ArticleNoticeCarousel({ announcements }: ArticleNoticeCarouselProps) {
  const noticeSlides =
    announcements.length > 0 ? announcements.map(toNoticeSlide) : [fallbackNoticeSlide];
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const activeSlide = noticeSlides[activeIndex] ?? noticeSlides[0];

  useEffect(() => {
    if (shouldReduceMotion || noticeSlides.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % noticeSlides.length);
    }, rotationDelay);

    return () => window.clearInterval(timer);
  }, [noticeSlides.length, shouldReduceMotion]);

  useEffect(() => {
    setActiveIndex(0);
  }, [noticeSlides.length]);

  return (
    <section
      aria-label="站点公告"
      aria-roledescription="carousel"
      style={noticeStatusStyle}
      className="rounded-3xl border border-(--glass-border) bg-white/72 p-4 text-foreground shadow-(--shadow-glass) backdrop-blur-xl dark:border-white/10 dark:bg-[oklch(0.22_0.032_252)] dark:text-white"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-normal text-foreground">
          <CuteIcon name="terminal-box-line" className="size-5 text-primary" />
          公告
        </h2>

        <div aria-label="切换公告" className="flex items-center gap-1.5">
          {noticeSlides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`查看公告：${slide.process}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
              style={index === activeIndex ? activeNoticeDotStyle : undefined}
              className={cn(
                "size-2.5 rounded-full bg-foreground/16 transition focus-visible:ring-3 focus-visible:ring-(--notice-status-color) focus-visible:outline-none dark:bg-white/18",
                index === activeIndex && "w-6",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-4 min-h-48 overflow-hidden rounded-2xl border border-(--glass-border) bg-[oklch(0.97_0.01_248)] p-0 font-mono text-[0.78rem] shadow-inner dark:border-white/10 dark:bg-[oklch(0.12_0.022_252)]">
        <div className="flex items-center justify-between gap-3 border-b border-foreground/10 bg-white/52 px-3 py-2 dark:border-white/10 dark:bg-white/7">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[oklch(0.67_0.18_25)]" />
            <span className="size-2.5 rounded-full bg-[oklch(0.78_0.16_82)]" />
            <span className="size-2.5 rounded-full bg-[oklch(0.7_0.15_154)]" />
          </div>

          <span className="truncate text-[0.68rem] font-black tracking-normal text-foreground/58 dark:text-white/52">
            notice.log
          </span>

          <div
            style={noticeStatusBadgeStyle}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.62rem] font-black tracking-normal"
          >
            <span className="relative flex size-1.5">
              <span
                style={activeNoticeDotStyle}
                className="absolute inline-flex size-full animate-ping rounded-full opacity-70 motion-reduce:hidden"
              />
              <span
                style={activeNoticeDotStyle}
                className="relative inline-flex size-1.5 rounded-full"
              />
            </span>
            LIVE
          </div>
        </div>

        <motion.div
          key={activeSlide.title}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/70 shadow-sm ring-1 ring-foreground/8 dark:bg-white/10 dark:ring-white/10">
              <CuteIcon
                name={activeSlide.icon}
                className={cn("size-5", activeSlide.iconClassName)}
              />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-[0.72rem] font-black text-primary dark:text-white/82">
                {activeSlide.process}
              </span>
              <span className="text-[0.66rem] font-bold text-muted-foreground dark:text-white/48">
                status: {activeSlide.status}
              </span>
            </span>
          </div>

          <div className="grid gap-2 rounded-xl border border-foreground/8 bg-white/46 p-3 text-foreground/80 dark:border-white/10 dark:bg-white/6 dark:text-white/70">
            <p className="flex gap-2">
              <span style={noticeStatusTextStyle}>$</span>
              <span className="min-w-0 wrap-anywhere">{activeSlide.command}</span>
            </p>
            <p className="flex gap-2">
              <span style={noticeStatusTextStyle}>ok</span>
              <span className="min-w-0 wrap-anywhere">{activeSlide.output}</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-[0.66rem] font-black text-muted-foreground dark:text-white/46">
            <span>{activeSlide.title}</span>
            <span>
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(noticeSlides.length).padStart(2, "0")}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function toNoticeSlide(announcement: SiteAnnouncementResponse): NoticeSlide {
  return {
    command: announcement.command,
    icon: toCuteIconName(announcement.icon),
    iconClassName: announcement.iconClassName,
    output: announcement.output,
    process: announcement.process,
    status: announcement.status,
    title: announcement.title,
  };
}

function toCuteIconName(icon: string): CuteIconName {
  return isCuteIconName(icon) ? icon : "terminal-box-line";
}

function isCuteIconName(icon: string): icon is CuteIconName {
  return (
    icon === "book-6-ai-line" ||
    icon === "bilibili-line" ||
    icon === "code-line" ||
    icon === "github-line" ||
    icon === "horn-line" ||
    icon === "magic-2-line" ||
    icon === "notebook-line" ||
    icon === "palette-2-line" ||
    icon === "question-line" ||
    icon === "refresh-2-line" ||
    icon === "sleep-line" ||
    icon === "sparkles-2-line" ||
    icon === "terminal-box-line"
  );
}

export { ArticleNoticeCarousel };
