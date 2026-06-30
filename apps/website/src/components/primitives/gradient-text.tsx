import * as React from "react";

import { cn } from "@/lib/utils";

function GradientText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="gradient-text"
      className={cn("bg-(image:--gradient-brand) bg-clip-text text-transparent", className)}
      {...props}
    />
  );
}

export { GradientText };
