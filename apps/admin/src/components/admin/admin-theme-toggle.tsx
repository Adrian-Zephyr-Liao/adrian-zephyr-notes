import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "../ui/button";

const themeEvent = "admin-theme-change";
function readTheme() {
  try {
    const saved = window.localStorage?.getItem("admin-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // The theme remains usable when browser storage is unavailable.
  }
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function subscribe(onChange: () => void) {
  window.addEventListener(themeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(themeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function AdminThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  return (
    <Button
      aria-label="切换主题"
      title={theme === "dark" ? "切换到亮色" : "切换到暗色"}
      size="icon"
      type="button"
      variant="ghost"
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        try {
          window.localStorage?.setItem("admin-theme", next);
        } catch {
          // Keep the current page theme even if it cannot be persisted.
        }
        document.documentElement.dataset.theme = next;
        document.documentElement.classList.toggle("dark", next === "dark");
        document.documentElement.style.colorScheme = next;
        window.dispatchEvent(new Event(themeEvent));
      }}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
export { AdminThemeToggle };
