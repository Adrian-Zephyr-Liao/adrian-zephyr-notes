import Image from "next/image";
import { cn } from "@/lib/utils";

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
        "pointer-events-none relative shrink-0 select-none",
        compact ? "h-32 w-28" : "h-48 w-40",
        className,
      )}
    >
      <Image
        src="/images/illustrations/guestbook-note-messenger.png"
        alt=""
        fill
        sizes={compact ? "112px" : "160px"}
        className="object-contain"
      />
    </div>
  );
}
export { GuestbookMascot };
