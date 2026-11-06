import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("admin-theme");
    const resolvedTheme = storedTheme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, []);

  return <Outlet />;
}
