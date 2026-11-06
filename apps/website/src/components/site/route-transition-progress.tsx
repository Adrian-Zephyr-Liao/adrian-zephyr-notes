"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 120;
const COMPLETE_DELAY_MS = 380;
const FALLBACK_DELAY_MS = 8000;

function RouteTransitionProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const currentRouteRef = useRef(route);
  const pendingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    for (const timerRef of [showTimerRef, hideTimerRef, fallbackTimerRef]) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const completeTransition = useCallback(() => {
    if (!pendingRef.current) {
      return;
    }

    pendingRef.current = false;
    // Cancel delayed feedback when a prefetched route finishes before it becomes visible.
    clearTimers();
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, COMPLETE_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => {
    function startTransition() {
      clearTimers();
      pendingRef.current = true;
      setProgress(8);

      showTimerRef.current = setTimeout(() => {
        setVisible(true);
        frameRef.current = requestAnimationFrame(() => {
          setProgress(72);
        });
      }, SHOW_DELAY_MS);

      fallbackTimerRef.current = setTimeout(completeTransition, FALLBACK_DELAY_MS);
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");

      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download") ||
        anchor.hasAttribute("data-native-navigation")
      ) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);

      if (
        url.origin === window.location.origin &&
        (url.pathname !== window.location.pathname || url.search !== window.location.search)
      ) {
        startTransition();
      }
    }

    function handlePopState() {
      const route = `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;
      if (route !== currentRouteRef.current) {
        startTransition();
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [clearTimers, completeTransition]);

  useEffect(() => {
    currentRouteRef.current = route;
    completeTransition();
  }, [route, completeTransition]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-80 h-1 overflow-hidden bg-transparent"
      >
        <div
          className="h-full origin-left rounded-r-full bg-primary shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_65%,transparent)] transition-[opacity,transform] duration-300 ease-(--ease-out-ui) will-change-transform motion-reduce:transition-none"
          style={{
            opacity: visible ? 1 : 0,
            transform: `scaleX(${Math.min(progress, 100) / 100})`,
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
