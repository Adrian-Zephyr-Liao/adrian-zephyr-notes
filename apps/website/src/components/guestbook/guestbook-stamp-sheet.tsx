import Image from "next/image";

import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const STAMP_SHEET_SRC = "/images/illustrations/guestbook-stamp-sheet.png";

function GuestbookStampSheet({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative h-20 w-28 select-none", className)}
    >
      <Image
        src={STAMP_SHEET_SRC}
        alt=""
        fill
        sizes="112px"
        className={cn(
          styles.stampsDrift,
          "object-contain drop-shadow-[0_10px_16px_rgba(18,58,69,0.16)]",
        )}
      />
    </div>
  );
}

export { GuestbookStampSheet };
