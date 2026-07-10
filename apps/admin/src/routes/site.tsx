import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { SiteConfigManagement } from "../features/site-config/site-config-management";

export const Route = createFileRoute("/site")({
  component: SiteRoute,
});

function SiteRoute() {
  return (
    <AdminAuthGate returnTo="/site">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="site" onLogout={onLogout}>
          <SiteConfigManagement />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
