"use client";

import { useEffect, useMemo, useState } from "react";

type UseTypewriterTextOptions = {
  intervalMs?: number;
};

const defaultTypewriterIntervalMs = 22;

function useTypewriterText(text: string, options: UseTypewriterTextOptions = {}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const [typedLength, setTypedLength] = useState(characters.length);
  const intervalMs = options.intervalMs ?? defaultTypewriterIntervalMs;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setTypedLength(characters.length);
      return;
    }

    setTypedLength(0);

    if (characters.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setTypedLength((current) => {
        const next = getNextTypedLength(current, characters.length);

        if (next === characters.length) {
          window.clearInterval(timer);
        }

        return next;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [characters, intervalMs]);

  return {
    isTyping: typedLength < characters.length,
    text: characters.slice(0, typedLength).join(""),
  };
}

function getNextTypedLength(current: number, total: number) {
  return Math.min(current + 1, total);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { defaultTypewriterIntervalMs, getNextTypedLength, useTypewriterText };
