import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1 rounded border px-2 py-0.5 text-[11px]/4 font-medium whitespace-nowrap tabular-nums",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/7 text-primary",
        secondary: "border-border/40 bg-secondary/70 text-secondary-foreground",
        outline: "border-border bg-card text-muted-foreground",
        destructive: "border-destructive/15 bg-destructive/8 text-destructive",
        success:
          "border-emerald-900/10 bg-emerald-900/6 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/8 dark:text-emerald-200",
        warning: "border-amber-600/15 bg-amber-500/8 text-amber-800 dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ className, variant }))} {...props} />
  );
}

export { Badge, badgeVariants };
