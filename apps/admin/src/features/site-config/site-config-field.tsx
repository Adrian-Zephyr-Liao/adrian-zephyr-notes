import type { ReactNode } from "react";

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-xs/5 font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export { Field };
