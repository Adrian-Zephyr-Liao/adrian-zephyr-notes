import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-background px-3 text-base md:text-sm text-foreground outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-(--ease-out-ui) placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
