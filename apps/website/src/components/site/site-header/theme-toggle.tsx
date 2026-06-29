"use client";

import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      className="bg-white/45 text-foreground/75 hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/15"
      size="icon"
      variant="ghost"
      type="button"
      aria-label={!mounted ? "切换主题" : isDark ? "切换到亮色模式" : "切换到暗色模式"}
      aria-pressed={mounted ? isDark : undefined}
      onClick={toggleTheme}
    >
      {isDark ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
    </Button>
  );
}

export { ThemeToggle };
