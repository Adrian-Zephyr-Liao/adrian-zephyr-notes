"use client";

import { useReducedMotion } from "motion/react";
import type { SiteAnnouncementResponse } from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";

function ArticleNoticeCarousel({ announcements }: { announcements: SiteAnnouncementResponse[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const active = announcements[activeIndex] ?? announcements[0];
  useEffect(() => {
    if (isPaused || shouldReduceMotion || announcements.length < 2) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % announcements.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [announcements.length, isPaused, shouldReduceMotion]);
  useEffect(() => {
    setActiveIndex(0);
  }, [announcements.length]);
  if (!active) return null;
  return (
    <section
      aria-label="站点公告"
      aria-roledescription="轮播"
      className="grid gap-3 border-t border-border pt-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">站内消息</h2>
        {announcements.length > 1 ? (
          <span className="font-mono text-xs text-muted-foreground">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(announcements.length).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <h3 className="text-base leading-7 font-semibold">{active.title}</h3>
      <p className="text-sm leading-7 wrap-anywhere text-muted-foreground">{active.output}</p>
      {announcements.length > 1 ? (
        <div aria-label="切换公告" className="flex flex-wrap items-center gap-1">
          {announcements.map((announcement, index) => (
            <button
              key={announcement.id}
              type="button"
              aria-label={`查看公告：${announcement.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => {
                setActiveIndex(index);
                setIsPaused(true);
              }}
              className="grid min-h-10 min-w-10 cursor-pointer place-items-center rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span
                className={index === activeIndex ? "h-0.5 w-6 bg-primary" : "h-0.5 w-4 bg-border"}
              />
            </button>
          ))}
          <button
            type="button"
            disabled={Boolean(shouldReduceMotion)}
            onClick={() => setIsPaused((current) => !current)}
            className="ml-auto min-h-10 cursor-pointer px-2 text-xs text-muted-foreground outline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
          >
            {shouldReduceMotion ? "手动切换" : isPaused ? "自动轮播" : "暂停轮播"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
export { ArticleNoticeCarousel };
