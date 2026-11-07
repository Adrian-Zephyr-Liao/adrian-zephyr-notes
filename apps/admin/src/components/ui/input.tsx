import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-10 w-full max-sm:h-11 rounded-lg border border-input bg-card px-3.5 text-base text-foreground md:text-sm outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-(--ease-out-ui) placeholder:text-muted-foreground/75 hover:border-foreground/35 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
