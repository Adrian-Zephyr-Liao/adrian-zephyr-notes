import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/admin/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { GuestbookModeration } from "../features/guestbook/guestbook-moderation";

export const Route = createFileRoute("/guestbook")({
  component: GuestbookRoute,
});

function GuestbookRoute() {
  return (
    <AdminAuthGate returnTo="/guestbook">
      {(admin, onLogout) => (
        <AdminShell admin={admin} section="guestbook" onLogout={onLogout}>
          <GuestbookModeration />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
