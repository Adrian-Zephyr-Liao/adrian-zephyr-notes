"use client";

import type { ArticleAiSummaryResponse } from "@adrian-zephyr-notes/contracts";
import { Sparkles } from "lucide-react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { TypewriterText } from "./typewriter-text";

type ArticleAiSummaryCardProps = {
  summary: ArticleAiSummaryResponse;
};

function ArticleAiSummaryCard({ summary }: ArticleAiSummaryCardProps) {
  return (
    <GlassPanel
      className="mb-7 overflow-hidden rounded-2xl p-0 sm:mb-8 sm:rounded-3xl"
      aria-label="AI 文章导读"
    >
      <section className="relative grid gap-3 p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/55 to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="grid size-8 place-items-center rounded-2xl bg-primary/12">
              <Sparkles className="size-4" />
            </span>
            AI 文章导读
          </div>
          <time className="text-xs text-muted-foreground" dateTime={summary.generatedAt}>
            {formatSummaryTime(summary.generatedAt)}
          </time>
        </div>
        <p className="text-sm leading-7 wrap-anywhere text-foreground/86 sm:text-base sm:leading-8">
          <TypewriterText text={summary.text} />
        </p>
      </section>
    </GlassPanel>
  );
}

function formatSummaryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export { ArticleAiSummaryCard };
