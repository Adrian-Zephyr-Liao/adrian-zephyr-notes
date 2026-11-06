import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

function TaxonomyFooter({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-16 flex flex-wrap justify-between gap-4 border-t border-border pt-7 text-[0.85rem] leading-[1.8] text-muted-foreground max-[680px]:mt-12">
      <p>还有许多值得继续探索的角落。</p>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 text-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {label} <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

export { TaxonomyFooter };
