"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const COMPLETE_DELAY_MS = 380;
const FALLBACK_DELAY_MS = 8000;

function RouteTransitionProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const firstRenderRef = useRef(true);
  const visibleRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    function clearTimers() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }

    function completeTransition() {
      if (!visibleRef.current) {
        return;
      }

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      setProgress(100);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, COMPLETE_DELAY_MS);
    }

    function startTransition() {
      clearTimers();
      visibleRef.current = true;
      setVisible(true);
      setProgress(8);

      frameRef.current = requestAnimationFrame(() => {
        setProgress(72);
      });

      fallbackTimerRef.current = setTimeout(completeTransition, FALLBACK_DELAY_MS);
    }

    function shouldHandleNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");

      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return false;
      }

      const url = new URL(anchor.href, window.location.href);

      if (url.origin !== window.location.origin) {
        return false;
      }

      return url.pathname !== window.location.pathname || url.search !== window.location.search;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (shouldHandleNavigation(event)) {
        startTransition();
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", startTransition);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", startTransition);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (!visibleRef.current) {
      return;
    }

    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, COMPLETE_DELAY_MS);
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-80 h-1 overflow-hidden bg-transparent"
      >
        <div
          className="h-full rounded-r-full bg-primary shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_65%,transparent)] transition-[width,opacity] duration-300 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            width: `${progress}%`,
          }}
        />
      </div>
      <span aria-live="polite" className="sr-only">
        {visible ? "页面加载中" : ""}
      </span>
    </>
  );
}

export { RouteTransitionProgress };
