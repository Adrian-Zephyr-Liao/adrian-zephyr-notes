import { icons as mingcuteIcons } from "@iconify-json/mingcute";
import type * as React from "react";

import { cn } from "@/lib/utils";

type CuteIconName =
  | "book-6-ai-line"
  | "bilibili-line"
  | "code-line"
  | "github-line"
  | "horn-line"
  | "magic-2-line"
  | "notebook-line"
  | "palette-2-line"
  | "question-line"
  | "refresh-2-line"
  | "sleep-line"
  | "sparkles-2-line"
  | "terminal-box-line";

type CuteIconProps = Omit<React.ComponentProps<"svg">, "name"> & {
  name: CuteIconName;
};

function CuteIcon({ name, className, ...props }: CuteIconProps) {
  const icon = mingcuteIcons.icons[name];
  const width = icon?.width ?? mingcuteIcons.width ?? 24;
  const height = icon?.height ?? mingcuteIcons.height ?? 24;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className={cn("size-4 shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: icon?.body ?? "" }}
      {...props}
    />
  );
}

export { CuteIcon };
export type { CuteIconName };
