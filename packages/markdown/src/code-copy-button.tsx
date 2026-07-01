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
      className="markdown-code-copy-button"
      data-status={status}
      type="button"
      onClick={copyCode}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{copied ? "已复制" : status === "failed" ? "失败" : "复制"}</span>
    </button>
  );
}

export { CodeCopyButton };
