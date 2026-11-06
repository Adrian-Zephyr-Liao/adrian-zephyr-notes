import { createFileRoute, useLocation } from "@tanstack/react-router";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { OAuthConsentPage } from "../features/auth/oauth-consent-page";

export const Route = createFileRoute("/oauth/device")({
  component: OAuthDeviceRoute,
});

function OAuthDeviceRoute() {
  const search = useLocation({ select: (location) => location.searchStr });
  const initialUserCode = new URLSearchParams(search).get("user_code") ?? "";

  return (
    <>
      <meta name="referrer" content="no-referrer" />
      <AdminAuthGate returnTo={`/oauth/device${search}`}>
        {(admin) => (
          <OAuthConsentPage admin={admin} initialUserCode={initialUserCode} key={search} />
        )}
      </AdminAuthGate>
    </>
  );
}
