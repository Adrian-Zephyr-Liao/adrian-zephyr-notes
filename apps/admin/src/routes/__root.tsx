import { CopilotKit } from "@copilotkit/react-core/v2";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AdminProviders>
      <Outlet />
    </AdminProviders>
  );
}

function AdminProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("admin-theme");
    const resolvedTheme = storedTheme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, []);

  return (
    <CopilotKit
      agent="admin-agent"
      credentials="include"
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={true}
    >
      {children}
    </CopilotKit>
  );
}
