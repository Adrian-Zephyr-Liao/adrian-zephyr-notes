import Link from "next/link";
import { Home } from "lucide-react";

function SiteBrand() {
  return (
    <Link
      className="group/site flex h-10 min-w-0 items-center gap-2 rounded-xl px-2 text-sm font-bold text-foreground transition-colors duration-150 ease-(--ease-out-ui) hover:bg-white/50 motion-reduce:transition-none sm:px-3 dark:hover:bg-white/10 [&_svg]:pointer-events-none"
      href="/"
      aria-label="返回首页"
    >
      <span className="hidden max-w-40 truncate sm:block">Adrian Zephyr Notes</span>
      <span className="block max-w-24 truncate sm:hidden">AZ Notes</span>
      <Home className="size-4 shrink-0 text-primary transition-transform duration-150 ease-(--ease-out-ui) motion-reduce:transition-none motion-reduce:group-hover/site:scale-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/site:scale-110" />
    </Link>
  );
}

export { SiteBrand };
