import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-(--glass-border) bg-background/45 px-3 py-2 text-sm text-foreground shadow-xs outline-none backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-200 ease-(--ease-out-ui) placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background/70 focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
