import Image from "next/image";

import { cn } from "@/lib/utils";
import styles from "./status-illustration.module.css";

const STATUS_ILLUSTRATION_IMAGE_SIZE = 768;

const statusIllustrations = {
  "not-found": {
    src: "/images/status/chibi-not-found.png",
  },
  error: {
    src: "/images/status/chibi-error.png",
  },
  "empty-comments": {
    src: "/images/status/chibi-empty-comments.png",
  },
  "empty-articles": {
    src: "/images/status/chibi-empty-articles.png",
  },
} as const;

type StatusIllustrationVariant = keyof typeof statusIllustrations;

type StatusIllustrationProps = {
  variant: StatusIllustrationVariant;
  className?: string;
};

function StatusIllustration({ variant, className }: StatusIllustrationProps) {
  const illustration = statusIllustrations[variant];

  return (
    <div aria-hidden="true" className={cn(styles.statusArtwork, "relative w-full", className)}>
      <span className={styles.statusHalo} />
      <Image
        alt=""
        src={illustration.src}
        width={STATUS_ILLUSTRATION_IMAGE_SIZE}
        height={STATUS_ILLUSTRATION_IMAGE_SIZE}
        sizes="(min-width: 640px) 272px, 176px"
        className={cn(styles.statusImage, "relative z-10 h-auto w-full object-contain")}
      />
    </div>
  );
}

export { StatusIllustration };
export type { StatusIllustrationVariant };
