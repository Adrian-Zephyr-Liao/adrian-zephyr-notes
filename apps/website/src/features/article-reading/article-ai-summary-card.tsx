"use client";

import type { ArticleAiSummaryResponse } from "@adrian-zephyr-notes/contracts";
import { Sparkles } from "lucide-react";
import { TypewriterText } from "./typewriter";

function ArticleAiSummaryCard({ summary }: { summary: ArticleAiSummaryResponse }) {
  return (
    <section className="mb-10 grid gap-3 border-y border-border py-6" aria-label="AI 文章导读">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles size={16} aria-hidden="true" />
          阅读之前
        </h2>
        <span className="text-xs text-muted-foreground">
          AI 文章导读 ·{" "}
          <time dateTime={summary.generatedAt}>
            {new Intl.DateTimeFormat("zh-CN", {
              dateStyle: "medium",
              timeZone: "Asia/Shanghai",
            }).format(new Date(summary.generatedAt))}
          </time>
        </span>
      </div>
      <p className="text-base leading-8 wrap-anywhere text-muted-foreground">
        <TypewriterText text={summary.text} />
      </p>
    </section>
  );
}
export { ArticleAiSummaryCard };
