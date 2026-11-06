import type { ReactNode } from "react";

import { StatusIllustration, type StatusIllustrationVariant } from "./status-illustration";

function StatusPage({
  actions,
  description,
  eyebrow,
  title,
  variant,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  variant: StatusIllustrationVariant;
}) {
  return (
    <main className="grid flex-1 items-center px-5 py-12 min-[681px]:px-8 min-[681px]:pt-16 min-[681px]:pb-24">
      <div className="mx-auto grid w-full max-w-260 items-center gap-8 min-[681px]:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)] min-[681px]:gap-16">
        <div>
          <p className="mb-4 font-display text-[5rem] leading-none tracking-[-0.065em] text-primary italic min-[681px]:text-[clamp(5rem,12vw,10rem)]">
            {eyebrow}
          </p>
          <h1 className="mb-5 text-[clamp(1.75rem,3.3vw,2.75rem)] leading-[1.5] font-bold text-balance">
            {title}
          </h1>
          <p className="max-w-lg text-[0.9rem] leading-[1.95] text-muted-foreground min-[681px]:text-base">
            {description}
          </p>
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        <StatusIllustration
          className="max-w-56 justify-self-end min-[681px]:max-w-92 min-[681px]:justify-self-center"
          variant={variant}
        />
      </div>
    </main>
  );
}

export { StatusPage };
