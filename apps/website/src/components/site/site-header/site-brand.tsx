import Link from "next/link";
import { Home } from "lucide-react";

function SiteBrand() {
  return (
    <Link
      className="group/site flex h-10 min-w-0 items-center gap-2 rounded-xl px-2 text-sm font-bold text-foreground transition duration-200 hover:bg-white/50 sm:px-3 dark:hover:bg-white/10 [&_svg]:pointer-events-none"
      href="/"
      aria-label="返回首页"
    >
      <span className="hidden max-w-40 truncate sm:block">Adrian Zephyr Notes</span>
      <span className="block max-w-24 truncate sm:hidden">AZ Notes</span>
      <Home className="size-4 shrink-0 text-primary transition duration-200 group-hover/site:scale-110" />
    </Link>
  );
}

export { SiteBrand };
