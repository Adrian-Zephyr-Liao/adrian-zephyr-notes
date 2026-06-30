"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Check, Copy } from "lucide-react";

function CodeCopyButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyCode(event: MouseEvent<HTMLButtonElement>) {
    const root = event.currentTarget.closest("[data-code-copy-root]");
    const code = root?.querySelector("pre code")?.textContent ?? "";

    if (!code) {
      setStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 1600);
    }
  }

  const copied = status === "copied";

  return (
    <button
      aria-label={copied ? "代码已复制" : "复制代码"}
      className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/70 px-2 text-xs font-medium whitespace-nowrap text-slate-600 transition outline-none select-none hover:bg-white hover:text-slate-950 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/14 dark:hover:text-white"
      type="button"
      onClick={copyCode}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{copied ? "已复制" : status === "failed" ? "失败" : "复制"}</span>
    </button>
  );
}

export { CodeCopyButton };
