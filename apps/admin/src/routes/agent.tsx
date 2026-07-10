import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/admin-shell/admin-shell";
import { AgentWorkbenchPage } from "../features/agent-workbench/agent-workbench-page";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";

export const Route = createFileRoute("/agent")({
  component: AgentRoute,
});

function AgentRoute() {
  return (
    <AdminAuthGate returnTo="/agent">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="agent" onLogout={onLogout}>
          <AgentWorkbenchPage />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
