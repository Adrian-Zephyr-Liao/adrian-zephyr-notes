import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { AdminDashboard } from "../features/dashboard/admin-dashboard";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <AdminAuthGate returnTo="/">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="overview" onLogout={onLogout}>
          <AdminDashboard />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
