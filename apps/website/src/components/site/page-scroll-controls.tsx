"use client";

import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";

import { Button } from "@/components/ui/button";

function PageScrollControls() {
  function scrollToEdge(edge: "top" | "bottom") {
    window.scrollTo({
      top: edge === "top" ? 0 : (document.scrollingElement?.scrollHeight ?? 0),
      left: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <nav
      aria-label="页面快捷导航"
      className="fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex gap-1 rounded-2xl border border-(--glass-border) bg-(--glass-surface-strong) p-1 shadow-(--shadow-glass) backdrop-blur-xl"
    >
      <Button
        className="min-h-11 min-w-11 flex-1 gap-2"
        onClick={() => scrollToEdge("top")}
        size="sm"
        title="回到顶部"
        type="button"
        variant="ghost"
      >
        <ArrowUpToLine aria-hidden="true" className="size-4" />
        <span className="sr-only">回到顶部</span>
      </Button>
      <Button
        className="min-h-11 min-w-11 flex-1 gap-2"
        onClick={() => scrollToEdge("bottom")}
        size="sm"
        title="直达底部"
        type="button"
        variant="ghost"
      >
        <ArrowDownToLine aria-hidden="true" className="size-4" />
        <span className="sr-only">直达底部</span>
      </Button>
    </nav>
  );
}

export { PageScrollControls };
