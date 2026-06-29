import * as React from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = React.ComponentProps<"div"> & {
  tone?: "default" | "strong" | "interactive";
};

const glassToneClassName = {
  default: "bg-(--glass-surface) shadow-(--shadow-glass)",
  strong: "bg-(--glass-surface-strong) shadow-(--shadow-glass-strong)",
  interactive:
    "bg-(--glass-surface) shadow-(--shadow-glass) transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-(--glass-surface-strong)",
} satisfies Record<NonNullable<GlassPanelProps["tone"]>, string>;

function GlassPanel({ className, tone = "default", ...props }: GlassPanelProps) {
  return (
    <div
      data-slot="glass-panel"
      className={cn(
        "rounded-xl border border-(--glass-border) backdrop-blur-xl",
        glassToneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}

export { GlassPanel };
