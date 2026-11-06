"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

function PageScrollControls() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setVisible(window.scrollY > 600);
    }
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <nav
      aria-label="页面快捷导航"
      className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 rounded-full border border-border bg-background/95 p-1 backdrop-blur"
    >
      <Button
        className="min-h-11 min-w-11 rounded-full"
        onClick={scrollToTop}
        size="sm"
        title="回到顶部"
        type="button"
        variant="ghost"
      >
        <ArrowUp aria-hidden="true" className="size-4" />
        <span className="sr-only">回到顶部</span>
      </Button>
    </nav>
  );
}

export { PageScrollControls };
