import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { AuditLogManagement } from "../features/audit/audit-log-management";

export const Route = createFileRoute("/audit")({
  component: AuditRoute,
});

function AuditRoute() {
  return (
    <AdminAuthGate returnTo="/audit">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="audit" onLogout={onLogout}>
          <AuditLogManagement />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
