import { cn } from "@/lib/utils";

type StatusIllustrationVariant = "not-found" | "error" | "empty-comments" | "empty-articles";

type StatusIllustrationProps = {
  variant: StatusIllustrationVariant;
  className?: string;
};

function StatusIllustration({ variant, className }: StatusIllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-auto w-full max-w-xs", className)}
      fill="none"
      viewBox="0 0 320 220"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${variant}-paper`} x1="86" x2="235" y1="44" y2="184">
          <stop stopColor="var(--card)" />
          <stop offset="1" stopColor="var(--muted)" />
        </linearGradient>
        <linearGradient id={`${variant}-accent`} x1="76" x2="250" y1="48" y2="176">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="190" fill="var(--foreground)" opacity="0.08" rx="86" ry="14" />
      {variant === "not-found" ? <NotFoundArtwork variant={variant} /> : null}
      {variant === "error" ? <ErrorArtwork variant={variant} /> : null}
      {variant === "empty-comments" ? <EmptyCommentsArtwork variant={variant} /> : null}
      {variant === "empty-articles" ? <EmptyArticlesArtwork variant={variant} /> : null}
    </svg>
  );
}

function NotFoundArtwork({ variant }: { variant: StatusIllustrationVariant }) {
  return (
    <>
      <path
        d="M86 72c0-15.5 12.5-28 28-28h92c15.5 0 28 12.5 28 28v98c0 8.8-7.2 16-16 16H102c-8.8 0-16-7.2-16-16V72Z"
        fill={`url(#${variant}-paper)`}
        stroke="var(--glass-border)"
        strokeWidth="2"
      />
      <path
        d="M113 78h86M113 103h72M113 128h49"
        stroke="var(--foreground)"
        opacity="0.18"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <circle
        cx="210"
        cy="129"
        r="27"
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="7"
      />
      <path d="m230 149 22 22" stroke="var(--primary)" strokeLinecap="round" strokeWidth="9" />
      <text
        fill="var(--primary)"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="42"
        fontWeight="900"
        x="102"
        y="166"
      >
        404
      </text>
      <path
        d="M67 86c15-22 30-26 45-14"
        stroke="var(--accent)"
        strokeDasharray="5 8"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M236 60c18 1 30 10 36 27"
        stroke="var(--primary)"
        strokeDasharray="5 8"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </>
  );
}

function ErrorArtwork({ variant }: { variant: StatusIllustrationVariant }) {
  return (
    <>
      <rect
        fill={`url(#${variant}-paper)`}
        height="126"
        rx="24"
        stroke="var(--glass-border)"
        strokeWidth="2"
        width="172"
        x="74"
        y="48"
      />
      <rect fill="var(--primary)" opacity="0.14" height="28" rx="10" width="124" x="98" y="74" />
      <path
        d="M103 126h114M103 148h74"
        stroke="var(--foreground)"
        opacity="0.2"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <circle cx="107" cy="88" fill="var(--destructive)" r="5" />
      <circle cx="124" cy="88" fill="var(--accent)" r="5" />
      <circle cx="141" cy="88" fill="var(--primary)" r="5" />
      <path
        d="m134 115 20 20 32-38"
        stroke={`url(#${variant}-accent)`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
      />
      <path
        d="M58 136h38M224 136h38"
        stroke="var(--destructive)"
        strokeLinecap="round"
        strokeWidth="6"
      />
      <path
        d="m69 124 16 24M251 124l-16 24"
        stroke="var(--destructive)"
        strokeLinecap="round"
        strokeWidth="6"
      />
    </>
  );
}

function EmptyCommentsArtwork({ variant }: { variant: StatusIllustrationVariant }) {
  return (
    <>
      <path
        d="M76 88c0-20 16-36 36-36h66c20 0 36 16 36 36v24c0 20-16 36-36 36h-25l-34 26v-26h-7c-20 0-36-16-36-36V88Z"
        fill={`url(#${variant}-paper)`}
        stroke="var(--glass-border)"
        strokeWidth="2"
      />
      <path
        d="M144 83c23-9 54 1 64 25 10 25-5 50-30 58l-22 7 9-21c-15-8-24-22-25-38"
        fill="var(--primary)"
        opacity="0.12"
      />
      <circle cx="117" cy="102" fill="var(--primary)" opacity="0.55" r="6" />
      <circle cx="145" cy="102" fill="var(--primary)" opacity="0.55" r="6" />
      <circle cx="173" cy="102" fill="var(--primary)" opacity="0.55" r="6" />
      <path
        d="M214 67c18 3 31 18 31 36"
        stroke="var(--accent)"
        strokeDasharray="5 8"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M74 158c-13-7-20-17-22-30"
        stroke="var(--primary)"
        strokeDasharray="5 8"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </>
  );
}

function EmptyArticlesArtwork({ variant }: { variant: StatusIllustrationVariant }) {
  return (
    <>
      <path
        d="M96 64c0-12.2 9.8-22 22-22h72c12.2 0 22 9.8 22 22v106H96V64Z"
        fill={`url(#${variant}-paper)`}
        stroke="var(--glass-border)"
        strokeWidth="2"
      />
      <path
        d="M118 81h72M118 106h54M118 131h66"
        stroke="var(--foreground)"
        opacity="0.18"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path d="M82 170h156" stroke="var(--primary)" strokeLinecap="round" strokeWidth="9" />
      <path
        d="M222 84h22c9 0 16 7 16 16v44"
        stroke="var(--accent)"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path
        d="M64 95v48c0 9 7 16 16 16h18"
        stroke="var(--primary)"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <circle cx="238" cy="155" fill="var(--accent)" opacity="0.35" r="13" />
      <circle cx="74" cy="76" fill="var(--primary)" opacity="0.18" r="14" />
    </>
  );
}

export { StatusIllustration };
export type { StatusIllustrationVariant };
