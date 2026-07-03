import { Compass, Dice5, Languages, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ThemeToggle } from "./theme-toggle";

function ConsoleSwitch() {
  return (
    <button
      className="group/console relative hidden h-8 w-12 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/40 shadow-sm transition duration-200 outline-none hover:bg-white/65 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:flex dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
      type="button"
      aria-label="中控台"
    >
      <span className="absolute left-2 size-1.5 rounded-full bg-primary transition group-hover/console:translate-x-0.5" />
      <span className="size-3.5 rounded-full border border-primary/45 bg-primary/20 shadow-[0_0_0_4px_rgba(255,255,255,0.22)]" />
      <span className="absolute right-2 size-1.5 rounded-full bg-primary/70 transition group-hover/console:-translate-x-0.5" />
    </button>
  );
}

function HeaderActions() {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        className="hidden bg-white/45 text-foreground/75 hover:bg-white/70 xl:inline-flex dark:bg-white/10 dark:hover:bg-white/15"
        size="icon"
        variant="ghost"
        aria-label="异次元之旅"
      >
        <Compass className="size-4" />
      </Button>
      <Button
        className="hidden bg-white/45 text-foreground/75 hover:bg-white/70 lg:inline-flex dark:bg-white/10 dark:hover:bg-white/15"
        size="icon"
        variant="ghost"
        aria-label="随机文章"
      >
        <Dice5 className="size-4" />
      </Button>
      <Button
        className="bg-white/45 text-foreground/75 hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/15"
        size="sm"
        variant="ghost"
        aria-label="搜索"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">搜索</span>
      </Button>
      <Button
        className="hidden bg-white/45 text-foreground/75 hover:bg-white/70 sm:inline-flex dark:bg-white/10 dark:hover:bg-white/15"
        size="icon"
        variant="ghost"
        aria-label="简繁转换"
      >
        <Languages className="size-4" />
      </Button>
      <ThemeToggle />
      <ConsoleSwitch />
    </div>
  );
}

export { HeaderActions };
