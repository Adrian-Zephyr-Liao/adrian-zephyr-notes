import * as React from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = React.ComponentProps<"div"> & {
  tone?: "default" | "strong" | "interactive";
};

const glassToneClassName = {
  default: "bg-[color:var(--glass-surface)] shadow-[var(--shadow-glass)]",
  strong: "bg-[color:var(--glass-surface-strong)] shadow-[var(--shadow-glass-strong)]",
  interactive:
    "bg-[color:var(--glass-surface)] shadow-[var(--shadow-glass)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-[color:var(--glass-surface-strong)]",
} satisfies Record<NonNullable<GlassPanelProps["tone"]>, string>;

function GlassPanel({ className, tone = "default", ...props }: GlassPanelProps) {
  return (
    <div
      data-slot="glass-panel"
      className={cn(
        "rounded-xl border border-[color:var(--glass-border)] backdrop-blur-xl",
        glassToneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}

export { GlassPanel };
