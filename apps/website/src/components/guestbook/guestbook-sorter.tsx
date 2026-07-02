import Image from "next/image";

import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const SORTER_SRC = "/images/illustrations/guestbook-post-sorter.png";

function GuestbookSorter({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative size-28 select-none sm:size-36", className)}
    >
      <span className="absolute bottom-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-foreground/10 blur-md dark:bg-black/35" />
      <Image
        src={SORTER_SRC}
        alt=""
        fill
        sizes="(min-width: 640px) 144px, 112px"
        className={cn(
          styles.sorterBob,
          "object-contain drop-shadow-[0_14px_22px_rgba(18,58,69,0.2)]",
        )}
      />
    </div>
  );
}

export { GuestbookSorter };
