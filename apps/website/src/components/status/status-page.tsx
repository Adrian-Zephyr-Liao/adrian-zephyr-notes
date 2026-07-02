import type { ReactNode } from "react";

import { GlassPanel } from "@/components/primitives/glass-panel";
import { StatusIllustration, type StatusIllustrationVariant } from "./status-illustration";

type StatusPageProps = {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  variant: StatusIllustrationVariant;
};

function StatusPage({ actions, description, eyebrow, title, variant }: StatusPageProps) {
  return (
    <main className="grid flex-1 place-items-center px-3 py-12 sm:px-4">
      <GlassPanel
        tone="strong"
        className="grid w-full max-w-3xl justify-items-center gap-6 rounded-2xl px-5 py-9 text-center sm:rounded-3xl sm:px-8 sm:py-12"
      >
        <StatusIllustration className="max-w-[17rem]" variant={variant} />
        <div className="grid max-w-xl gap-3">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
          <h1 className="text-3xl/tight font-black tracking-normal text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
      </GlassPanel>
    </main>
  );
}

export { StatusPage };
