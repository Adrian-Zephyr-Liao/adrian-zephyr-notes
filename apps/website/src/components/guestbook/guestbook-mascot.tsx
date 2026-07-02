import Image from "next/image";

import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const MASCOT_SRC = "/images/illustrations/guestbook-note-messenger.png";

function GuestbookMascot({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative isolate select-none",
        compact ? "h-28 w-24" : "h-48 w-36 sm:h-56 sm:w-42",
        className,
      )}
    >
      <span
        className={cn(
          styles.paperPlane,
          "absolute top-4 right-0 z-20 h-5 w-8 rotate-[-14deg] bg-primary/75 [clip-path:polygon(0_48%,100%_0,72%_52%,100%_100%)]",
        )}
      />
      <span className="absolute bottom-1 left-1/2 z-0 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground/10 blur-md dark:bg-black/35" />
      <Image
        src={MASCOT_SRC}
        alt=""
        fill
        priority={false}
        sizes={compact ? "96px" : "(min-width: 640px) 168px, 144px"}
        className={cn(
          styles.mascotFloat,
          "object-contain drop-shadow-[0_18px_26px_rgba(18,58,69,0.22)]",
        )}
      />
    </div>
  );
}

export { GuestbookMascot };
