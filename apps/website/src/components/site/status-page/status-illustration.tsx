import Image from "next/image";

import { cn } from "@/lib/utils";
import { statusIllustrations } from "./data";

type StatusIllustrationVariant = keyof typeof statusIllustrations;

function StatusIllustration({
  variant,
  className,
}: {
  variant: StatusIllustrationVariant;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("relative isolate w-full", className)}>
      <Image
        alt=""
        src={statusIllustrations[variant]}
        width={768}
        height={768}
        sizes="(min-width: 640px) 272px, 176px"
        className="relative z-10 h-auto w-full object-contain"
      />
    </div>
  );
}

export { StatusIllustration };
export type { StatusIllustrationVariant };
