import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inlineActionButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center rounded-md px-1 font-medium transition outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-muted hover:text-foreground",
        primary: "text-primary hover:bg-primary/8 hover:text-primary/80",
      },
      size: {
        xs: "h-5 gap-0.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-6 gap-1 text-xs [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "xs",
    },
  },
);

function InlineActionButton({
  className,
  size = "xs",
  type = "button",
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof inlineActionButtonVariants>) {
  return (
    <button
      type={type}
      className={cn(inlineActionButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { InlineActionButton, inlineActionButtonVariants };
