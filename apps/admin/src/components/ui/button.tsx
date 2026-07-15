import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap shadow-sm transition-[background-color,border-color,color,box-shadow,scale] duration-200 ease-(--ease-out-ui) outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary/70 bg-primary text-primary-foreground shadow-[0_8px_22px_color-mix(in_oklch,var(--primary)_24%,transparent)] hover:bg-primary/88 hover:shadow-[0_10px_26px_color-mix(in_oklch,var(--primary)_30%,transparent)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border-(--glass-border) bg-(--glass-surface) hover:bg-(--glass-surface-strong) hover:text-foreground dark:border-(--glass-border)",
        ghost: "shadow-none hover:bg-foreground/6 hover:text-foreground",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-3.5",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
