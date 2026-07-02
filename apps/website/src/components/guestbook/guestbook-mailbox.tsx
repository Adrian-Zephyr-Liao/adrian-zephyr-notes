import Image from "next/image";

import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const MAILBOX_SRC = "/images/illustrations/guestbook-star-mailbox.png";

function GuestbookMailbox({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative size-20 select-none", className)}
    >
      <span className="absolute bottom-1 left-1/2 h-3 w-14 -translate-x-1/2 rounded-full bg-foreground/10 blur-md dark:bg-black/35" />
      <Image
        src={MAILBOX_SRC}
        alt=""
        fill
        sizes="80px"
        className={cn(
          styles.mailboxPop,
          "object-contain drop-shadow-[0_12px_18px_rgba(18,58,69,0.18)]",
        )}
      />
    </div>
  );
}

export { GuestbookMailbox };
