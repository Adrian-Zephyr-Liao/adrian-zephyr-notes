import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    let resolvedTheme = "light";
    try {
      if (window.localStorage.getItem("admin-theme") === "dark") resolvedTheme = "dark";
    } catch {
      // The editorial workspace also opens when storage is unavailable.
    }

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, []);

  return <Outlet />;
}
